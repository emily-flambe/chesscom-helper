# Chesscom Helper

A lightweight web application for adding and removing Chess.com users from a display list, powered by the [Chess.com public API](https://www.chess.com/news/view/published-data-api).

(The goal of this project is to add features that are actually useful, like subscribing to notifications about a user's activity - but we aint there yet.)

## Overview

This project provides a simple way to manage and view basic information about Chess.com users:

Backend: A Django (Python) application that fetches data from the Chess.com API and stores a list of tracked users.

Frontend: A Next.js application bundled with Vite and styled with MUI that presents the user list and corresponding Chess.com data in a minimalistic interface.

## Getting Started

### Prerequisites

Rename the provided env.example file to .env to ensure the necessary environment variables are in place:

```bash
cp env.example .env
```
Build and start the containers:

```bash
make build
make up
```

### Interacting with the API

Once your containers are running, you can use curl (or any REST client) to interact with the API. For example, to add a user:

```bash
curl -X POST http://localhost:8000/api/chesscom-app/add-user/ \
     -H "Content-Type: application/json" \
     -d '{"username": "magnuscarlsen"}'
```

You can similarly remove a user with a corresponding `/remove-user/` endpoint, supplying the username in the request body.

## Frontend

To run the frontend:

```bash
make web
cd frontend
npm install
npm run dev
```

The development server should start on http://localhost:5173.

## Screenshots

Don't want to actually run the thing yourself? That's fine, this is what it all looks like:

<details>
<summary>Click to expand</summary>

![alt text](screenshots/home.png)

![alt text](screenshots/users.png)

![alt text](screenshots/add_user.png)

![alt text](screenshots/user_details.png)

</details>
