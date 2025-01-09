import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'project.settings')
django.setup()

from zuzu_maps.services import RouteService

# Ustaw parametry
start_latitude = 50.064873
start_longitude = 19.923948
min_dist = 20
max_dist = 30

trip = RouteService(start_latitude, start_longitude, min_dist, max_dist)
trip.generate_trip_sequence()
