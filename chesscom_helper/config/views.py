from django.http import HttpResponse
from django.shortcuts import render
from django.http import HttpResponse
from django.shortcuts import render, redirect
from django.urls import reverse_lazy


def homepage(request):

    html = "<html><body><div>Chesscom Helper Thingy</div></body></html>"
    return HttpResponse(html)
