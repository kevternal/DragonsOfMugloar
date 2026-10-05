# Build stage: compiles the jar with the project's Maven wrapper; only Docker is needed on the host.
FROM eclipse-temurin:25-jdk-alpine AS build
WORKDIR /src
COPY mvnw pom.xml ./
COPY .mvn .mvn
# The cache mount keeps downloaded dependencies between builds.
RUN --mount=type=cache,target=/root/.m2 ./mvnw -q dependency:go-offline
COPY src src
RUN --mount=type=cache,target=/root/.m2 ./mvnw -q package -DskipTests

# Runtime stage: a JRE only. History files go to /app/games-history (npc.history-dir is relative).
FROM eclipse-temurin:25-jre-alpine
WORKDIR /app
COPY --from=build /src/target/dragons-of-mugloar-*.jar app.jar
ENTRYPOINT ["java", "-jar", "app.jar"]
