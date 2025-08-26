Any GET Returning 401 and the following:

```
{
    "status": "UNAUTHORIZED",
    "message": "JWT_TOKEN_EXPIRED",
    "description": "The Token has expired on 2025-08-26T18:25:44Z."
}
```


# Get Access Token
curl 'https://login.ezinfra.net/api/refreshToken/getAccessToken' \
  -H 'accept: application/json' \
  -H 'accept-language: en-US,en;q=0.9' \
  -H 'authorization: Bearer eyJhbGciOiJFUzI1NiIsInR5cCI6IkpXVCJ9.eyJqIjoiNjFlMzExMmUtYzdkZC00ZGYwLWI0NWUtMWMwNzVjYzIwMGQ0IiwiaWF0IjoxNzU2MjMyMTQ0LCJleHAiOjE3NTYyNzUzNDR9.tqMucCikj7-btD0gj6LKCxdtOXyCZySKYdyEsgEPalMb0mV4Fo268JQ_HKOo8M1YIFtQMsmUyMzqPL0qMOsMUQ' \
  -H 'content-type: application/json' \
  -H 'origin: https://pms.ezderm.com' \
  -H 'priority: u=1, i' \
  -H 'referer: https://pms.ezderm.com/' \
  -H 'sec-ch-ua: "Not;A=Brand";v="99", "Google Chrome";v="139", "Chromium";v="139"' \
  -H 'sec-ch-ua-mobile: ?0' \
  -H 'sec-ch-ua-platform: "macOS"' \
  -H 'sec-fetch-dest: empty' \
  -H 'sec-fetch-mode: cors' \
  -H 'sec-fetch-site: cross-site' \
  -H 'user-agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36'


  # Response
  ```
  {
    "accessToken": "eyJhbGciOiJFUzI1NiIsInR5cCI6IkpXVCJ9.eyJpYXQiOjE3NTYyMzQxNzQsImV4cCI6MTc1NjIzNDc3NCwibiI6ImRyZ2pva2EiLCJhIjo0LCJ1IjoiMjkzYTFiNjAtNWFjMC0xMWYwLTk5NTUtNmZiM2ZiODFkZWY3IiwicCI6IjRjYzk2OTIyLTRkODMtNDE4My04NjNiLTc0OGQ2OWRlNjIxZiIsImQiOiIwMTM4MSIsInoiOiJBbWVyaWNhL0xvc19BbmdlbGVzIiwiZyI6IjYxZTMxMTJlLWM3ZGQtNGRmMC1iNDVlLTFjMDc1Y2MyMDBkNCIsInMiOjQ3MDM5ODMsInQiOjIsInNyIjozNTYzfQ.M3sTw1qf_j_6hrHDc9ThZyeUNWyk9dpWqKTlkanOEoUny8Lucuq-K19p0-3BbWS9VXfhZ1g5rr3OdJscbrcaqQ"
}
  ```