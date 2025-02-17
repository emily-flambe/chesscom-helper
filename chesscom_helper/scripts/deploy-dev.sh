docker-compose restart
docker-compose exec web python manage.py migrate
docker-compose exec web python manage.py collectstatic --noinput
docker-compose exec web bash -c "npm run build"
docker-compose exec web bash -c "npm run dev"