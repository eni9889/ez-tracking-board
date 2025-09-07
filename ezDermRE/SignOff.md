# Sign Note Request
curl -H "Host: srvprod.ezinfra.net" -H "accept: application/json" -H "content-type: application/json" -H "authorization: Bearer eyJhbGciOiJFUzI1NiIsInR5cCI6IkpXVCJ9.eyJpYXQiOjE3NTcyNjA3MTcsImV4cCI6MTc1NzI2MTMxNywibiI6InduYXNpciIsImEiOjEsInUiOiJkZDBjOTg2Yi0xYjZkLTRhZGUtODljOC1mMmI5NmQ1OTU4Y2MiLCJwIjoiNGNjOTY5MjItNGQ4My00MTgzLTg2M2ItNzQ4ZDY5ZGU2MjFmIiwiZCI6IjAxMzgxIiwieiI6IkFtZXJpY2EvRGV0cm9pdCIsImciOiJlMzliMTkzMy1jZDc1LTQ4MDItODlhYS00Y2ExMTk2ZWU5N2QiLCJyIjozLCJzIjo0MDk2LCJ0IjoyfQ.bB9Z6cHQyV8JoNX9tmg_cJ8_LpnEb2saK6JKP1omPd-bxxCIGlCg0PUp9V-Vf6sh3ezzOlmGSy3ZZQRuWx6Omw" -H "encounterid: 3938bd20-7454-11f0-924d-af253a24f314" -H "patientid: 765e2cbf-543e-4ea8-be74-5350a6915e5b" -H "user-agent: ezDerm/4.28.1 (build:133.1; macOS(Catalyst) 15.6.1)" -H "accept-language: en-US;q=1.0" --data-binary "{\"room\":0,\"dateOfArrival\":\"2025-09-05T20:33:03Z\",\"status\":\"SIGNED_OFF\",\"id\":\"3938bd20-7454-11f0-924d-af253a24f314\"}" --compressed "https://srvprod.ezinfra.net/ezderm-webservice/rest/encounter/signOff"

# Response
:status: 200
date: Sun, 07 Sep 2025 15:59:57 GMT
content-length: 0
vary: Origin
vary: Access-Control-Request-Method
vary: Access-Control-Request-Headers