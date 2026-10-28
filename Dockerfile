FROM python:3.11-slim
WORKDIR /app
COPY . /app
ENV NO_BROWSER=1
ENV PORT=8888
EXPOSE 8888
CMD ["python3", "server.py", "--no-browser"]
