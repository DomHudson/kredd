Context:
1. `endrse` is a directory containing a React prototype of the application. It can be ignored in most cases.
2. I execute the code within a Docker environment, which you are not running within, so you may see frequent linting errors.
3. Any change to nginx.conf should almost always be made to nginx-ssl.conf and visa versa.

Do not:
1. Do not manually generate migrations. In all cases, the user will generate them through Django's manage.py suite.
2. Do not manually edit requirements.txt. In all cases, the user will generate them themselves.
