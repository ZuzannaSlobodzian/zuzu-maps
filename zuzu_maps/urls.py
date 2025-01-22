from . import views
from django.urls import path
from .views import TripView

urlpatterns = [
    path('trip', TripView.as_view(), name='trip-api'),
    path('', views.website_view, name='website')
]
