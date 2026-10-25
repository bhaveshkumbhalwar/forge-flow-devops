
pipeline {
    agent any

    options {
        timestamps()
        disableConcurrentBuilds()
    }

    stages {
        stage('Checkout') {
            steps {
                checkout scm
            }
        }

        stage('Initialize rollback state') {
            steps {
                sh '''
                    rm -f .deploy_started .previous_image_tag
                    echo "Rollback state initialized for this build."
                '''
            }
        }

        stage('Install dependencies') {
            steps {
                sh 'node --version'
                sh 'npm --version'
                sh 'npm ci'
            }
        }

        stage('Automated tests') {
            steps {
                sh 'npm test'
            }
        }

        stage('Prepare rollback') {
            steps {
                sh '''
                    set -eu
                    PREVIOUS_IMAGE_ID=$(docker inspect taskflow-app --format '{{.Image}}')
                    PREVIOUS_TAG="taskflow-devops-capstone:rollback-${BUILD_NUMBER}"
                    docker tag "$PREVIOUS_IMAGE_ID" "$PREVIOUS_TAG"
                    printf '%s' "$PREVIOUS_TAG" > .previous_image_tag
                    echo "Saved rollback image: $PREVIOUS_TAG"
                '''
            }
        }

        stage('Build Docker image') {
            steps {
                sh '''
                    set -eu
                    docker build -t "taskflow-devops-capstone:${BUILD_NUMBER}" .
                '''
            }
        }

        stage('Deploy') {
            steps {
                withCredentials([
                    string(credentialsId: 'grafana-admin-password',
                           variable: 'GRAFANA_ADMIN_PASSWORD')
                ]) {
                    sh '''
                        set -eu
                        touch .deploy_started

                        APP_IMAGE="taskflow-devops-capstone:${BUILD_NUMBER}" \
                        APP_VERSION="${BUILD_NUMBER}" \
                        docker compose -p taskflow-devops-capstone up -d --no-build --force-recreate
                    '''
                }
            }
        }

        stage('Health check') {
            steps {
                sh '''
                    set -eu
                    for i in $(seq 1 30); do
                        if curl -fsS http://127.0.0.1:3000/api/health; then
                            echo "FlowForge health check passed."
                            exit 0
                        fi
                        sleep 2
                    done
                    echo "Health check failed."
                    exit 1
                '''
            }
        }

        stage('Promote image') {
            steps {
                sh '''
                    set -eu
                    docker tag "taskflow-devops-capstone:${BUILD_NUMBER}" taskflow-devops-capstone:latest
                    echo "Healthy build promoted to latest."
                '''
            }
        }
    }

    post {
        success {
            echo 'FlowForge CI/CD deployment completed successfully.'
        }

        failure {
            echo 'Pipeline failed. Attempting rollback if deployment started.'
            withCredentials([
                string(credentialsId: 'grafana-admin-password',
                       variable: 'GRAFANA_ADMIN_PASSWORD')
            ]) {
                sh '''
                    set -eu
                    if [ -f .deploy_started ] && [ -f .previous_image_tag ]; then
                        PREVIOUS_TAG=$(cat .previous_image_tag)
                        echo "Rolling back to $PREVIOUS_TAG"

                        APP_IMAGE="$PREVIOUS_TAG" \
                        APP_VERSION="rollback-${BUILD_NUMBER}" \
                        docker compose -p taskflow-devops-capstone up -d --no-build --force-recreate

                        for i in $(seq 1 30); do
                            if curl -fsS http://127.0.0.1:3000/api/health >/dev/null; then
                                echo "Rollback health check passed."
                                exit 0
                            fi
                            sleep 2
                        done

                        echo "Rollback health check failed."
                        exit 1
                    else
                        echo "Deployment did not start; rollback not needed."
                    fi
                '''
            }
        }
    }
}
