FROM gradle:8.5 as builder

COPY build.gradle .
COPY ./gradle.properties .
COPY ./settings.gradle .
COPY gradlew .
COPY ./gradle ./gradle
COPY ./src ./src

RUN gradle clean build

FROM openjdk:8-jre

COPY --from=builder /home/gradle/build/distributions/stacked-off-1.0.3.zip /stacked-off-1.0.3.zip
RUN unzip /stacked-off-1.0.3.zip -d /root

CMD [ "/root/stacked-off-1.0.3/bin/stacked-off" ]
