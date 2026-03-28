from django.http import JsonResponse

def home(request):
    return JsonResponse({
        "message": "Django backend with core project and main app is running successfully!"
    })