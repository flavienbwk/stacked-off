import Navigo from './navigo.js'

const root = document.location.href.replace(/((?:\w+:\/\/)?[^\/]+).*/, "$1")
console.log("root:" + root)
const router = new Navigo(root);

var currentToDocIndexExclusive = 0
var lastSearchText = ""

router.hooks({
    before: function(done, params) {
        clearMessagesAndErrors()
        done()
    }
});

router
    .on({
        '/admin': function (params, queryString) {
            console.log("Resolved to /admin")
            var queryParams = convertQueryStringToJson(queryString)
            let parentIndexDir = queryParams["parentIndexDir"];
            if(parentIndexDir != null && parentIndexDir != ""){
                doPost("/rest/admin", parentIndexDir => showAdmin(parentIndexDir, "Your index directory has been updated."), "parentIndexDir=" + parentIndexDir);
            } else {
                doGet("/rest/admin", parentIndexDir => showAdmin(parentIndexDir));
            }
        },
        '/sites': function () {
            console.log("Resolved to /sites")
            doGet("/rest/sites", sites => showSites(sites));
        },
        '/search': {
            uses: function (params, queryString) {
                console.log("Resolved to /search")
                var queryParams = convertQueryStringToJson(queryString)
                if(lastSearchText != queryParams.searchText){
                    currentToDocIndexExclusive = 0;
                    lastSearchText = queryParams.searchText
                }
                var fromDocIndexInclusive;
                var toDocIndexExclusive;
                if(queryParams.toDoc != null){
                    fromDocIndexInclusive = currentToDocIndexExclusive
                    toDocIndexExclusive = parseInt(queryParams.toDoc)
                } else {
                    fromDocIndexInclusive = 0
                    toDocIndexExclusive = 10
                }
                doGet("/rest/search?fromDocIndexInclusive=" + fromDocIndexInclusive +
                    "&toDocIndexExclusive=" + toDocIndexExclusive +
                    "&searchText=" + queryParams.searchText + (queryParams.explain != null ? "&explain=" + queryParams.explain: ""), results => {

                    var hasMoreResults = results.totalHits > toDocIndexExclusive
                    var newSearchPage = (fromDocIndexInclusive == 0)
                    currentToDocIndexExclusive = toDocIndexExclusive
                    showResults(results, newSearchPage, hasMoreResults)
                });
            },
            hooks: {
                leave: function (params) {
                    currentToDocIndexExclusive = 0;
                    lastSearchText = ""
                }
            }
        },
        '/questions/:questionUid': function (params) {
            console.log("Resolved to /questions/:uid")
            doGet("/rest/questions/" + params.questionUid, question => showQuestion(question));
        },
        '/load/chooseSitesXmlFile': function (params) {
            console.log("/load/chooseSitesXmlFile")
            loadNewSites_chooseSitesXmlFile()
        },
        '/load/selectSitesToLoad': function (params, queryString) {
            console.log("/load/selectSitesToLoad")
            var queryParams = convertQueryStringToJson(queryString)
            doGet("/rest/sedir?path=" + queryParams.path, seDirSites => loadNewSites_selectSitesToLoad(queryParams.path, seDirSites));
        },
        '/load/run': function (params, queryString) {
            console.log("/load/run")
            var queryParams = convertQueryStringToJson(queryString)
            doGet("/rest/loadSites?path=" + queryParams.path + "&seDirSiteIds=" + queryParams.seDirSiteIds, status => showStatusWhileRunning());
        },
        '/status': function (params) {
            console.log("/status")
            showStatusWhileRunning()
        },
        '/indexes': function (params) {
            console.log("/indexes")
            doGet("/rest/indexes", indexStats => showIndexes(indexStats))
        },
        '*': function () {
            console.log("Resolved to wildcard")
            doGet("/rest/sites", sites => showSites(sites));
        }
    })
    .resolve();

router.purgeSite = purgeSite
export default router;

function sleep (time) {
    return new Promise((resolve) => setTimeout(resolve, time));
}

function convertQueryStringToJson(queryString) {
    var pairs = queryString.split('&');

    var result = {};
    pairs.forEach(function(pair) {
        pair = pair.split('=');
        result[pair[0]] = decodeURIComponent(pair[1] || '');
    });
    return JSON.parse(JSON.stringify(result));
}

function showAdmin(parentIndexDir, message){
    showMessage(message)
    const markup = `<h1>Index Directory</h1>
                <p>Please select the directory where your indexes are/will be stored.</p>
                <p>If you already have sites loaded, and you change this directory.  Your indexes will still 
                be on disk, but you won't see them in StackedOff.  To see them again, set the directory back to where
                it was pointing to previously.</p>
                <br/>
                <p><i>(The file picker does not consistently function. If it doesn't show, the best course of action is to close and rerun StackedOff.)</i></p>
                <br/>
                <div class="div-load-sites">
                    <input id="index-parent-dir"
                            class="wide-text-input text-input"
                            type="text"
                            value="${parentIndexDir}"/>
                    <input id="index-parent-dir-picker" type="button" value="Open Picker" onclick="fetch('/rest/directoryPicker').then((response) => {
                        if (response.ok) {
                            response.text().then((text) => {
                                $('#index-parent-dir')[0].value = text;
                            });
                        }
                    });">
                </div>
                <br/>
                <input id="sites-xml-chosen-next-button"
                    type="button"
                    value="OK"
                    onclick="router.navigate('/admin?parentIndexDir=' + $('#index-parent-dir')[0].value.replace(/\\\\/g, '/'))">
                `;
    $("#content")[0].innerHTML = markup
}

function loadNewSites_chooseSitesXmlFile(){
    var lastStackExchangePath = Cookies.get('lastStackExchangePath') != null ? Cookies.get('lastStackExchangePath'): ''
    const markup = `<h1>Load new site(s)</h1>
                <h2>Step 1. Enter the path of the a downloaded stack dump directory</h2>
                <div><i>(This cannot be a file chooser due to browser security restrictions.)</i></div>
                <br/>
                <div class="div-load-sites">
                    <input id="sites-xml-chooser"
                            class="wide-text-input text-input"
                            type="text"
                            value="${lastStackExchangePath}"
                            onchange="$('#sites-xml-chosen-next-button')[0].disabled=false"/>
                </div>
                <br/>
                <input id="sites-xml-chosen-next-button"
                    type="button"
                    value="Next"
                    onclick="router.navigate('/load/selectSitesToLoad?path=' + $('#sites-xml-chooser')[0].value.replace(/\\\\/g, '/'))">
                `;
    $("#content")[0].innerHTML = markup
}

function loadNewSites_selectSitesToLoad(seDir, seDirSites){
    Cookies.set('lastStackExchangePath', seDir);
    // language=HTML
    const markup = `<h1>Load new site(s)</h1>
            <h2>Step 2. Select the sites that you wish to load</h2>
            <input
                class="sites-selected-to-load-button"
                type="button"
                value="Next"
                disabled="true"
                onclick="router.navigate('/load/run?path=${seDir}&seDirSiteIds=' + $('.site-selection-checkbox:checkbox:checked').map(function(){return this.value}).get().join(','))"/>
            <table class="data-table">
                <tr>
                <th>Id</th>
                <th>Site Url</th>
                <th>files</th>
                <th>load</th>
                </tr>
            ${seDirSites.map(seDirSite =>
               `<tr>
                    <td>${seDirSite.site.seSiteId}</td>
                    <td>${seDirSite.site.url}</td>
                    <td>${seDirSite.zipFiles.length}</td>
                    <td><input
                            type="checkbox"
                            class="site-selection-checkbox"
                            value="${seDirSite.site.seSiteId}"
                            onchange="$('.sites-selected-to-load-button')[0].disabled=false">
                    </td>
                </tr>`).join('')}
            </table>
            `

    $("#content")[0].innerHTML = markup
}

function showStatusOnlyIfRunning(){
    doGet("/rest/status", status => {
        if(!status.running) return;
        showStatus(status);
        showStatusWhileRunning()
    });
}

function showStatusWhileRunning(){
    router.pause();
    router.navigate('/status');
    router.resume();
    doGet("/rest/status", status => {
        showStatus(status);
        if(!status.running) return;
        sleep(1000).then(() => {
            showStatusWhileRunning()
        });
    });
}

function loadStatus(){
    doGet("/rest/status", status => showStatus(status));
}

function showStatus(status){
    var statusStr = ""
    if(status.currentOperationProgress != "Complete") {
        statusStr += "<h1>Operation currently in progress...</h1>";
    } else {
        statusStr += "<h1>Operation complete</h1>";
    }
    statusStr += "<pre>=============================================================================\n";
    statusStr += status.operationHistory.join("\n");
    statusStr += "\n";
    if(status.currentOperationProgress != "") {
        statusStr += "-----------------------------------------------------------------------------\n";
        statusStr += status.currentOperationProgress + "\n";
    }
    statusStr += "=============================================================================</pre>"
    $("#content")[0].innerHTML = statusStr
    return status.running
}


function showIndexes(indexStats) {
    const markup = `
        <h1>Indexes</h1>
        <table class="data-table">
            <tr><th>index</th><th># docs</th></tr>
            <tr><td>questionIndex</td><td>${indexStats.indexSizes.questionIndex}</td></tr>
            <tr><td>indexedSiteIndex</td><td>${indexStats.indexSizes.indexedSiteIndex}</td></tr>
            <tr><td>stagingPostIndex</td><td>${indexStats.indexSizes.stagingPostIndex}</td></tr>
            <tr><td>stagingCommentIndex</td><td>${indexStats.indexSizes.stagingCommentIndex}</td></tr>
            <tr><td>stagingUserIndex</td><td>${indexStats.indexSizes.stagingUserIndex}</td></tr>
        </table>`;
    $("#content")[0].innerHTML = markup
}


function showQuestion(question) {
    const markup = `
        <h1 class="question-heading">${escapeHtml(question.title)}</h1>
        <div class="question">
            ${renderPost(question, question.indexedSite.seSite, null)}
            ${question.answers.length == 0 ? "" : `
                <h2 class="answers-heading">${question.answers.length} Answer${question.answers.length > 1 ? 's' : ''}</h2>`}
        </div>
        ${question.answers.length == 0 ? "" : `
            <div class="answers">
                ${question.answers.map(post => `
                <div class="answer"> 
                    ${renderPost(post, question.indexedSite.seSite, question.acceptedAnswerUid)}
                </div>`).join('\n')}     
            </div>`
        }`;
    $("#content")[0].innerHTML = markup
    $(document).ready(function () {
        $('.no_broken img').error(function () {
            $(this).addClass('broken');
        });
    });
}


function renderPost(post, seSite, acceptedAnswerUid){
    return `
    <table class="post">
        <tr>
            <td class="score-details">
            <span class="score">${post.score}</span>
            ${post.favoriteCount != null && post.favoriteCount > 0 ? `
                <div class="favorite-count">
                    <img class="star" display="block" width="18" src="static/star.png"/>
                    <div class="fav-count">${post.favoriteCount}</div>    
                </div>`: ""}
            ${acceptedAnswerUid != null && post.uid == acceptedAnswerUid ? `
                <div class="favorite-count">
                    <img class="tick" display="block" width="18" src="static/tick.png"/>
                </div>`: ""}
            </div>
            </td>
            <td>
                <div class="post-body">
                    ${post.htmlContent}
                </div>            
                <div class="post-details">
                    <div class="user-details rounded-blue-box">
                        <div class="asked">${post.parentUid == null ? 'asked': 'answered'} ${formatDateTime(post.creationDate)}</div>
                        <div class="display-name"><a class="online-link" href="http://stackexchange.com/users/${post.userAccountId}">${post.userDisplayName}</a></div>
                        <div class="reputation">${post.userReputation}</div>
                    </div> 
                    ${post.tags == null ? '': `                                               
                    <span class="tags">
                        ${post.tags
                            .split("><")
                            .map(tag => tag.replace("<", "").replace(">", ""))
                            .map(tag => `<span class="tag rounded-blue-box">${tag}</span>`)
                            .join('')}    
                    </span>`}
                    ${post.parentUid != null ? '': `
                        <span>
                            <a class="online-link" href="${seSite.url}/questions/${post.postId}">jump to online version</a>
                        </span>
                        <span class="last-activity">
                            edited ${formatDateTime(post.lastActivityDate)}
                        </span>`}
                </div>
                <table class="comments">
                    ${post.comments.map(comment =>
                    `<tr class="comment">
                        <td class="comment-score">
                            ${comment.score > 0 ? comment.score: ""}
                        </td>
                        <td class="comment-content">
                            <span class="comment-text">${comment.textContent}</span>
                            <span class="comment-user">&#8211;&nbsp;${comment.userDisplayName}</span>
                            <span class="comment-datetime">${formatDateTime(comment.creationDate)}</span>
                        </td>
                    </tr>`).join('\n')}
                </table>
            </td>
        </tr>       
    </table>`
}


function showResults(results, newSearchPage, hasMoreResults){
    if(newSearchPage){
        $("#content")[0].innerHTML = `<div class="result-summary">${results.totalHits} results, took ${results.queryTimeMs}ms</div>`
    }
    $("#more-button-div").remove()
    $("#content")[0].innerHTML += `
                ${results.questionSummaries.map(question =>

        `<table class="result">
            <tr>
                <td class="result-score-td">
                    <span class="result-score">
                        ${question.score}
                    </span>    
                </td>
                <td>
                    <div class="result-content">
                        <h2 class="results-heading">
                            <a class="result-link" data-navigo href="/questions/${question.uid}">
                                ${escapeHtml(question.title)}
                            </a>
                        </h2>
                        <div class="result-meta">
                            <span>${question.numberOfAnswers} answer${question.numberOfAnswers == 1 ? "": "s"}</span>
                            <span class="result-tags">tags: ${question.tags == null ? "": question.tags.replace('<', '').replace('>', ' ')}</span>
                            <span class="result-site">${question.siteDomain}</span>
                            <span class="result-query-score">query-score: ${question.queryScore}</span>
                        </div>
                        <div class="result-body">
                            <span class="result-createddate">${formatDate(question.createdDate)} - </span>
                            <span>${question.searchResultText}</span>
                        </div>
                        ${question.queryExplanation == "null" ? "": `
                            <a href="javascript:void(0);" id="show-${question.uid.replace('.', '-')}" 
                                onclick="document.getElementById('explain-${question.uid.replace('.', '-')}').style.display='block'; 
                                         document.getElementById('show-${question.uid.replace('.', '-')}').style.display='none';
                                         document.getElementById('hide-${question.uid.replace('.', '-')}').style.display='inline';
                                         ">explain</a>
                            <a href="javascript:void(0);" id="hide-${question.uid.replace('.', '-')}" style="display:none"
                                onclick="document.getElementById('explain-${question.uid.replace('.', '-')}').style.display='none'; 
                                         document.getElementById('show-${question.uid.replace('.', '-')}').style.display='inline';
                                         document.getElementById('hide-${question.uid.replace('.', '-')}').style.display='none';
                                         ">hide</a>
                            <pre style="display:none" id="explain-${question.uid.replace('.', '-')}">${question.queryExplanation}</pre>
                        `} 
                    </div>
                </td>
            </tr>
         </table>`).join('')}`;

    if(hasMoreResults){
        var nextToDocIndexExclusive=currentToDocIndexExclusive + 10
        $("#content")[0].innerHTML += `
            <div id="more-button-div">
                <input type="button" 
                    id="more-button" 
                    value="Load more results..." 
                    onclick='router.navigate("/search?searchText=${lastSearchText}&toDoc=${nextToDocIndexExclusive}")'/>
            </div>`
    }
    router.updatePageLinks()
}


function purgeSite(indexedSiteId){
    const confirmed = confirm("Do you wish to purge this site from your index?")
    if(confirmed){
        doGet("/rest/purgeSite/" + indexedSiteId, sites => showSites(sites));
    }
}


function showSites(indexedSites){
    if(indexedSites.length == 0){
        const markup = `
                <br/>
                <span>You have no sites loaded.  Click here to load sites from a stackdump download</span>
                <br/><br/>
                <input type="button" onclick="router.navigate('/load/chooseSitesXmlFile')" value="Load new site(s)"/>
                `
        $("#content")[0].innerHTML = markup
    } else {
        const markup = `
                    <table class="data-table content-start-spacer">
                        <tr>
                            <th>Id</th>
                            <th>TinyName</th>
                            <th>Name</th>
                            <th>Url</th>
                            <th>Loaded</th>
                            <th>Operation</th>
                        </tr>
                        ${indexedSites.map(indexedSite =>
                        `<tr>
                            <td>${indexedSite.indexedSiteId}</td>
                            <td>${indexedSite.seSite.tinyName}</td>
                            <td>${indexedSite.seSite.name}</td>
                            <td>${indexedSite.seSite.url}</td>
                            <td>${indexedSite.status.toLowerCase().replace("_", " ")}</td>
                            <td><input type="button" value="Delete" onclick="router.purgeSite('${indexedSite.indexedSiteId}')"/></td>
                        </tr>`).join('')}
                    </table>`;
        $("#content")[0].innerHTML = markup
    }
}


function doGet(address, callback){
    $.ajax({
        url: address,
        type: 'get',
        success: function( data, textStatus, jQxhr ){
            callback(data)
        },
        error: function( jqXhr, textStatus, errorThrown ){
            showError(jqXhr.responseText)
        }
    });
}

function doPost(address, callback, params){
    $.ajax({
        url: address,
        type: 'post',
        contentType: 'application/x-www-form-urlencoded',
        data: params,
        success: function( data, textStatus, jQxhr ){
            callback(data)
        },
        error: function( jqXhr, textStatus, errorThrown ){
            showError(errorThrown + ":  " + jqXhr.responseText)
        }
    });
}

function showMessage(message){
    if(message != null){
        $('#messages')[0].innerHTML = message
        $('#messages').css('display', 'block')
    }
}

function showError(error){
    if(error != null){
        $('#errors')[0].innerHTML = error
        $('#errors').css('display', 'block')
    }
}

function clearMessagesAndErrors(){
    $('#messages')[0].innerHTML = ""
    $('#messages').css('display', 'none')
    $('#errors')[0].innerHTML = ""
    $('#errors').css('display', 'none')
}

function formatDateTime(dateStr){
    return dateStr.replace('T', ' ').replace(/:\d\d\.\d\d\d/, '')
}

function formatDate(dateStr){
    return dateStr.replace(/T.*/, '')
}

var matchHtmlRegExp = /["'&<>]/

function escapeHtml (string) {
    var str = '' + string
    var match = matchHtmlRegExp.exec(str)

    if (!match) {
        return str
    }

    var escape
    var html = ''
    var index = 0
    var lastIndex = 0

    for (index = match.index; index < str.length; index++) {
        switch (str.charCodeAt(index)) {
            case 34: // "
                escape = '&quot;'
                break
            case 38: // &
                escape = '&amp;'
                break
            case 39: // '
                escape = '&#39;'
                break
            case 60: // <
                escape = '&lt;'
                break
            case 62: // >
                escape = '&gt;'
                break
            default:
                continue
        }

        if (lastIndex !== index) {
            html += str.substring(lastIndex, index)
        }

        lastIndex = index + 1
        html += escape
    }

    return lastIndex !== index
        ? html + str.substring(lastIndex, index)
        : html
}

showStatusOnlyIfRunning();