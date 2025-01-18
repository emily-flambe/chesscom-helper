from django.http import HttpResponse
from django.shortcuts import render
from django.http import HttpResponse
from django.shortcuts import render, redirect
from django.urls import reverse_lazy


def notify_me_home(request):

    html = "<html><body><div>Notify Me about things</div></body></html>"
    return HttpResponse(html)
