# chesscom_helper

Cool fun things with the Chess.com API, which is very much public, so we can go all CRAZY with it.

# Start the thing

You'll need an env file. The default one provided works fine, so just rename `env.example` to `.env`, and then run the handy make commands to get things going.

```shell
cp env.example .env
make build
make up
```

# API

Once you've got the thing running, you can use cURL commands to interact with the API.

```shell
curl -X POST http://localhost:8000/api/chesscom-app/add-user/ \
     -H "Content-Type: application/json" \
     -d '{"username": "magnuscarlsen"}'
```