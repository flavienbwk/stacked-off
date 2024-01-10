package org.tools4j.stacked.web

import io.ktor.application.Application
import io.ktor.application.ApplicationCallPipeline
import io.ktor.application.call
import io.ktor.application.install
import io.ktor.features.*
import io.ktor.gson.gson
import io.ktor.http.HttpStatusCode
import io.ktor.http.Parameters
import io.ktor.http.content.resource
import io.ktor.http.content.resources
import io.ktor.http.content.static
import io.ktor.request.path
import io.ktor.request.receive
import io.ktor.response.respond
import io.ktor.response.respondRedirect
import io.ktor.routing.Route
import io.ktor.routing.get
import io.ktor.routing.post
import io.ktor.routing.routing
import io.ktor.server.engine.applicationEngineEnvironment
import io.ktor.server.engine.connector
import io.ktor.server.engine.embeddedServer
import io.ktor.server.netty.Netty
import org.tools4j.stacked.index.*
import java.io.File
import java.text.DateFormat
import java.util.concurrent.atomic.AtomicReference
import java.lang.System
import javax.swing.JFileChooser


class Server {
    companion object {
        var instance = Instance()

        @JvmStatic
        fun main(args: Array<String>) {

            val env = applicationEngineEnvironment {
                module {
                    mainServer()
                }
                connector {
                    host = "0.0.0.0"
                    port = instance.diContext.getPort()
                }
            }
            embeddedServer(Netty, env).start(wait = true)
        }

        private fun Application.mainServer() {
            val loadInProgress = AtomicReference<JobStatus>(NullJobStatus())

            install(DefaultHeaders) {
                header("cacheDirSet", (instance.diContext.getIndexParentDir() != null).toString())
            }
            install(Compression)
            install(CallLogging)
            install(CORS) {
                anyHost()
            }
            install(ContentNegotiation) {
                gson {
                    setDateFormat(DateFormat.LONG)
                    setPrettyPrinting()
                }
            }
            install(StatusPages) {
                exception<Throwable> { cause ->
                    logger.error(cause.message, cause)
                    call.respond(HttpStatusCode.InternalServerError, ExceptionToString(cause).toString())
                }
            }

            routing {
                intercept(ApplicationCallPipeline.Setup) {
                    if (instance.diContext.getIndexParentDir() == null
                        && !call.request.path().startsWith("/admin")
                        && !call.request.path().startsWith("/rest")
                        && !call.request.path().contains("static")
                        && !call.request.path().contains("favicon.ico")
                    ) {

                        call.respondRedirect("/admin", false)
                        return@intercept finish()
                    }
                }

                post("/rest/admin") {
                    val parameters = call.receive<Parameters>()
                    val parentIndexDir = parameters["parentIndexDir"]
                    if (parentIndexDir == null || parentIndexDir.isEmpty()) {
                        call.respond(HttpStatusCode.InternalServerError, "Please enter an index directory path")
                    } else if (!File(parentIndexDir).exists()) {
                        call.respond(HttpStatusCode.InternalServerError, "Dir does not exist: $parentIndexDir")
                    } else if (!File(parentIndexDir).isDirectory()) {
                        call.respond(HttpStatusCode.InternalServerError, "Path is not a directory: $parentIndexDir")
                    } else if (instance.diContext.getIndexParentDir() != null
                        && File(parentIndexDir).canonicalPath.equals(File(instance.diContext.getIndexParentDir()).canonicalPath)) {
                        call.respond(
                            HttpStatusCode.NotAcceptable,
                            "New path is the same as the existing path: $parentIndexDir"
                        )
                    } else {
                        instance.diContext.setIndexParentDir(parentIndexDir)
                        instance = Instance()
                        call.respond(parentIndexDir)
                    }
                }

                get("/rest/admin") {
                    call.respond(instance.diContext.getIndexParentDir() ?: "")
                }

                get("/rest/runPerfTest") {
                    call.respond("Took: " + PerfTest(instance).run() + "ms")
                }

                get("/rest/sites") {
                    val sites = instance.indexes.indexedSiteIndex.getAll()
                    call.respond(sites)
                }

                get("/rest/questions/{id}") {
                    val post = instance.questionIndex.getQuestionByUid(call.parameters["id"]!!)
                    if (post == null)
                        call.respond(HttpStatusCode.NotFound)
                    else
                        call.respond(post)
                }

                get("/rest/search") {
                    val fromDocIndexInclusive = call.parameters["fromDocIndexInclusive"]?.toInt() ?: 0
                    val toDocIndexExclusive = call.parameters["toDocIndexExclusive"]?.toInt() ?: 10
                    val explain = call.parameters.contains("explain")
                    val explainValue = call.parameters["explain"]

                    if (explain && explainValue != null && explainValue.length > 0) {
                        call.respond(
                            instance.questionIndex.searchForQuestionSummaryInResults(
                                call.parameters["searchText"]!!, explainValue
                            )
                        )
                    } else {
                        call.respond(
                            instance.questionIndex.searchForQuestionSummaries(
                                call.parameters["searchText"]!!,
                                fromDocIndexInclusive,
                                toDocIndexExclusive,
                                explain
                            )
                        )
                    }
                }

                get("/rest/sedir") {
                    val seDirPath = call.parameters["path"]!!
                    try {
                        val seDirSites = SeDir(seDirPath).getContents().getSites()
                        call.respond(seDirSites)
                    } catch (e: Exception) {
                        call.respond(
                            HttpStatusCode.InternalServerError,
                            e.message ?: "Error parsing dir: [${seDirPath}]"
                        )
                    }
                }

                get("/rest/loadSites") {
                    val newLoadStatus = JobStatusImpl()
                    val currentLoadStatus = loadInProgress.updateAndGet({ previousJobStatus ->
                        if (previousJobStatus != null && previousJobStatus.running) previousJobStatus
                        else newLoadStatus
                    })
                    if (currentLoadStatus !== newLoadStatus) {
                        call.respond(HttpStatusCode.InternalServerError, "Job already running")
                    } else {
                        val seDirPath = call.parameters["path"]!!
                        val seDirSiteIds = call.parameters["seDirSiteIds"]!!.split(",")
                        Thread({
                            try {
                                instance.seDirParser.parse(
                                    seDirPath,
                                    { seSite -> seDirSiteIds.contains(seSite.seSiteId) },
                                    newLoadStatus
                                )
                            } catch (e: Exception) {
                                loadInProgress.get().addOperation("Exception during initialization: $e")
                                loadInProgress.get().running = false
                            }
                        }).start()
                        call.respond(HttpStatusCode.OK, newLoadStatus)
                    }
                }

                get("/rest/status") {
                    call.respond(loadInProgress.get())
                }

                get("/rest/indexes") {
                    call.respond(IndexStats(instance.indexes))
                }

                get("/rest/purgeSite/{id}") {
                    instance.indexes.questionIndex.purgeSite(call.parameters["id"]!!)
                    instance.indexes.indexedSiteIndex.purgeSite(call.parameters["id"]!!)
                    val sites = instance.indexes.indexedSiteIndex.getAll()
                    call.respond(sites)
                }

                get("/rest/directoryPicker") {
                    val chooser = JFileChooser()
                    chooser.setFileSelectionMode(JFileChooser.DIRECTORIES_ONLY)

                    val returnVal = chooser.showOpenDialog(null)
                    if (returnVal == JFileChooser.APPROVE_OPTION) call.respond(chooser.getSelectedFile().getAbsolutePath())
                    else call.respond("")
                }


                resource("/", "webapp/index.html")
                resource("/*", "webapp/index.html")
                resource("/*/*", "webapp/index.html")
                static("static") {
                    resources("webapp")
                }
                static("*/static") {
                    resources("webapp")
                }
            }
        }

        fun setupResourcesAndSettings(route: Route){
            route.resource("/", "webapp/index.html")
            route.resource("/*", "webapp/index.html")
            route.resource("/*/*", "webapp/index.html")
            route.static("static") {
                route.resources("webapp")
            }
            route.static("*/static") {
                route.resources("webapp")
            }
        }

    }
}