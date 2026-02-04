# Сборка Docker monolith-full v0.8.0

## Шаги

1. Собрать образ `monolith-full.Dockerfile`
2. Тегировать как `ghcr.io/komleff/slime-arena-monolith-full:0.8.0` и `:latest`
3. Опубликовать в GitHub Container Registry

## Команды

```bash
docker build -f docker/monolith-full.Dockerfile -t ghcr.io/komleff/slime-arena-monolith-full:0.8.0 .
docker tag ghcr.io/komleff/slime-arena-monolith-full:0.8.0 ghcr.io/komleff/slime-arena-monolith-full:latest
docker push ghcr.io/komleff/slime-arena-monolith-full:0.8.0
docker push ghcr.io/komleff/slime-arena-monolith-full:latest
```
