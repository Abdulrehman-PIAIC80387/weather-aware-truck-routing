from datetime import timedelta

from django.utils import timezone
from rest_framework import serializers

# The risk rules and routing are tuned for the lower 48 states.
LATITUDES, LONGITUDES = (24.3, 49.5), (-125.0, -66.8)
MAX_DAYS_AHEAD = 7


class CoordinatesField(serializers.ListField):
    child = serializers.FloatField()
    default_error_messages = {"outside": "Must be inside the contiguous United States."}

    def __init__(self, **kwargs):
        super().__init__(min_length=2, max_length=2, help_text="[latitude, longitude]", **kwargs)

    def to_internal_value(self, data):
        latitude, longitude = super().to_internal_value(data)
        inside = LATITUDES[0] <= latitude <= LATITUDES[1] and (
            LONGITUDES[0] <= longitude <= LONGITUDES[1]
        )
        if not inside:
            self.fail("outside")
        return round(latitude, 5), round(longitude, 5)


class PlanRequestSerializer(serializers.Serializer):
    origin = CoordinatesField()
    destination = CoordinatesField()
    departure = serializers.DateTimeField(help_text="ISO 8601 with a UTC offset")
    load_lb = serializers.IntegerField(min_value=0, max_value=80_000)
    interval = serializers.ChoiceField(choices=[10, 25, 50], help_text="Checkpoint spacing, miles")

    def validate_departure(self, value):
        now = timezone.now()
        if value < now - timedelta(hours=1):
            raise serializers.ValidationError("Departure cannot be in the past.")
        if value > now + timedelta(days=MAX_DAYS_AHEAD):
            raise serializers.ValidationError(f"Departure must be within {MAX_DAYS_AHEAD} days.")
        return value

    def validate(self, attrs):
        if attrs["origin"] == attrs["destination"]:
            raise serializers.ValidationError({"destination": "Must differ from the origin."})
        return attrs
