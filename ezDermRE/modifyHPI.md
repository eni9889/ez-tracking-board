# Modify HPI Request
curl -H "Host: srvprod.ezinfra.net" -H "accept: application/json" -H "content-type: application/json" -H "authorization: Bearer eyJhbGciOiJFUzI1NiIsInR5cCI6IkpXVCJ9.eyJpYXQiOjE3NTcyNjM4NjgsImV4cCI6MTc1NzI2NDQ2OCwibiI6ImRyZ2pva2EiLCJhIjoxLCJ1IjoiMjkzYTFiNjAtNWFjMC0xMWYwLTk5NTUtNmZiM2ZiODFkZWY3IiwicCI6IjRjYzk2OTIyLTRkODMtNDE4My04NjNiLTc0OGQ2OWRlNjIxZiIsImQiOiIwMTM4MSIsInoiOiJBbWVyaWNhL0RldHJvaXQiLCJnIjoiODE5MzQ2ZGUtZDQyYS00YWQwLWIzMzctZWZiYjc5MTg4NWM3IiwiciI6NjQsInMiOjAsInQiOjJ9.QnkSrFQyv6ENXjjk1bplwrx0mYsf9wfWd-DJ9kYUFTw7KClXYQArl8kXI5uj5RXSgrjRhb0q862Bjq3lHYzOXA" -H "encounterid: A23D8989-1E97-4194-8504-A82630CB970A" -H "patientid: EE3FEDA1-4EC5-48F3-9FE4-C8C3E1A66299" -H "user-agent: ezDerm/4.28.1 (build:133.1; macOS(Catalyst) 15.6.1)" -H "accept-language: en-US;q=1.0" --data-binary "{\"note\":\"Testing Text Addition\",\"encounterId\":\"A23D8989-1E97-4194-8504-A82630CB970A\",\"type\":\"HISTORY_OF_PRESENT_ILLNESS\"}" --compressed "https://srvprod.ezinfra.net/ezderm-webservice/rest/progressnote/setPNInfo"

# Response
{
	"type": "HISTORY_OF_PRESENT_ILLNESS",
	"encounterId": "A23D8989-1E97-4194-8504-A82630CB970A",
	"note": "Testing Text Addition"
}