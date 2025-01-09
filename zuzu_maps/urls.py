from django.urls import path

from . import views
from .views import TripView

urlpatterns = [
    path('trip', TripView.as_view(), name='trip-api'),  # Correct use of as_view()
    path('', views.website_view, name='website'),
]