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

# Frontend

The frontend is a Next.js app that uses the API to fetch data and display it. What it lacks in beauty, it makes up for through the simple miracle of its existence.

```shell
make web
cd frontend
npm run dev
```

This should start the frontend on http://localhost:5173. Neat!