"""
Django settings for cta project.

Generated by 'django-admin startproject' using Django 5.0.4.

For more information on this file, see
https://docs.djangoproject.com/en/5.0/topics/settings/

For the full list of settings and their values, see
https://docs.djangoproject.com/en/5.0/ref/settings/
"""

import json
import os


def get_env_variable(var_name, default=None):
    """Get the environment variable or return exception"""
    try:
        env = os.environ[var_name]
    except KeyError:
        if default is not None:
            return default

        error_msg = "Set the {} env variable".format(var_name)
        raise Exception("ImproperlyConfigured: {}".format(error_msg))

    if env.lower() == "true":
        return True
    elif env.lower() == "false":
        return False
    else:
        return env


def get_release_sha():
    deploy_json_file = "/app/deploy.json"

    if os.path.exists(deploy_json_file):
        deploy_info = json.load(open(deploy_json_file))

        return deploy_info

    return False


# Quick-start development settings - unsuitable for production
# See https://docs.djangoproject.com/en/5.0/howto/deployment/checklist/

# SECURITY WARNING: keep the secret key used in production secret!
SECRET_KEY = "django-insecure-b48ta14-l45z4q$4sqarf(@5&^5xojsku0t85x0!af6+@f=bbj"


# SECURITY WARNING: don't run with debug turned on in production!
DEBUG = True

ALLOWED_HOSTS = ["*"]


# Application definition

INSTALLED_APPS = [
    "django.contrib.admin.apps.SimpleAdminConfig",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    ## Third-party apps
    # "django_extensions",
    "adminplus",
    # "rest_framework",
    # "django_vite",
    # Apps in this project
    "chesscom_app",
]

MIDDLEWARE = [
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.security.SecurityMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
    "whitenoise.middleware.WhiteNoiseMiddleware",
]

STORAGES = {
    "staticfiles": {
        "BACKEND": "whitenoise.storage.CompressedManifestStaticFilesStorage",
    },
}

ROOT_URLCONF = "config.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": ["/app/templates"],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.debug",
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "config.wsgi.application"

# Internationalization
# https://docs.djangoproject.com/en/5.0/topics/i18n/

LANGUAGE_CODE = "en-us"

TIME_ZONE = "UTC"

USE_I18N = True

USE_TZ = True


# Static files (CSS, JavaScript, Images)
# https://docs.djangoproject.com/en/5.0/howto/static-files/

STATIC_ROOT = get_env_variable("STATIC_ROOT", default="/app/static")
STATIC_URL = "static/"

# This config will move the Vite build output to the STATIC_ROOT under assets
STATICFILES_DIRS = [f"{STATIC_ROOT}/js/app/public/"]

# Default primary key field type
# https://docs.djangoproject.com/en/5.0/ref/settings/#default-auto-field

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"
