FROM alpine:3.22

RUN apk add --no-cache curl jq zip

COPY apps/workflow-demo-seed/seed.sh /usr/local/bin/seed-kajay-review-demo
COPY apps/sdk-demo/public/review-demo-survey.json /opt/kajay/review-demo-survey.json
RUN chmod 0755 /usr/local/bin/seed-kajay-review-demo

ENTRYPOINT ["/usr/local/bin/seed-kajay-review-demo"]
