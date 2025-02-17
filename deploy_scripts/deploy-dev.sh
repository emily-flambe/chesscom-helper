docker-compose restart
docker-compose exec web python ../manage.py migrate
docker-compose exec web python ../manage.py collectstatic --noinput
docker-compose exec web bash -c "npm run build"
docker-compose exec -T web bash -c "nohup npm run dev > /dev/null 2>&1 &"