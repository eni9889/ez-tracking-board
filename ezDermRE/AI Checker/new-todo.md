# Create a ToDo
curl -H "Host: srvprod.ezinfra.net" -H "accept: application/json" -H "content-type: application/json" -H "authorization: Bearer eyJhbGciOiJFUzI1NiIsInR5cCI6IkpXVCJ9.eyJpYXQiOjE3NTU1Mzc4OTMsImV4cCI6MTc1NTUzODQ5MywibiI6ImRyZ2pva2EiLCJhIjoxLCJ1IjoiMjkzYTFiNjAtNWFjMC0xMWYwLTk5NTUtNmZiM2ZiODFkZWY3IiwicCI6IjRjYzk2OTIyLTRkODMtNDE4My04NjNiLTc0OGQ2OWRlNjIxZiIsImQiOiIwMTM4MSIsInoiOiJBbWVyaWNhL0NoaWNhZ28iLCJnIjoiOWMzZjg0YTgtMDQwYy00NzBmLWFmNGYtOWIyODNhNzc5YjYyIiwiciI6NjQsInMiOjAsInQiOjJ9.pUuzrE7cHnXgcJ-hQU-HA0vUkQ-k8-JgEvyhASl0sUfIyszWlMqMYv_8VV9vqR_0-C3lFu6bUgT5RwmlYM8gDg" -H "patientid: 13f743a4-235a-4899-822d-3d34911bf289" -H "user-agent: ezDerm/4.28.1 (build:133.1; macOS(Catalyst) 15.6.0)" -H "accept-language: en-US;q=1.0" --data-binary "{\"reminderEnabled\":false,\"subject\":\"This is a Test Subject\",\"users\":[{\"userId\":\"dd0c986b-1b6d-4ade-89c8-f2b96d5958cc\",\"userType\":\"WATCHER\"},{\"userId\":\"293a1b60-5ac0-11f0-9955-6fb3fb81def7\",\"userType\":\"WATCHER\"},{\"userId\":\"293a1b60-5ac0-11f0-9955-6fb3fb81def7\",\"userType\":\"ASSIGNEE\"}],\"description\":\"This is a message\",\"id\":\"B3D98ED8-FB4E-47A7-B371-971D6EAF8D01\",\"links\":[{\"order\":0,\"linkEntityId\":\"13f743a4-235a-4899-822d-3d34911bf289\",\"description\":\"Latika Hawk (LAHA0004)\",\"linkType\":\"PATIENT\"}]}" --compressed "https://srvprod.ezinfra.net/ezderm-webservice/rest/task/add"

# Create ToDo Response:
{
	"id": "B3D98ED8-FB4E-47A7-B371-971D6EAF8D01"
}

# Get ToDos 
curl -H "Host: srvprod.ezinfra.net" -H "accept: application/json" -H "content-type: application/json" -H "authorization: Bearer eyJhbGciOiJFUzI1NiIsInR5cCI6IkpXVCJ9.eyJpYXQiOjE3NTc1MjU0OTQsImV4cCI6MTc1NzUyNjA5NCwibiI6InduYXNpciIsImEiOjEsInUiOiJkZDBjOTg2Yi0xYjZkLTRhZGUtODljOC1mMmI5NmQ1OTU4Y2MiLCJwIjoiNGNjOTY5MjItNGQ4My00MTgzLTg2M2ItNzQ4ZDY5ZGU2MjFmIiwiZCI6IjAxMzgxIiwieiI6IkFtZXJpY2EvRGV0cm9pdCIsImciOiIyZWUxYzJhZS1mNjU5LTRlMjUtOTQ4OS0yMjRhYzMwNGQxYTQiLCJyIjozLCJzIjo0MDk2LCJ0IjoyfQ.HQtHk4vXngA1ZJdX3R3wMAHPbYQ2SrJ65fZ3AHjP3wJQtkc4C9RPUQzNAYRSSjh1nLTs0esCFfO-49YO11eAOA" -H "user-agent: ezDerm/4.28.1 (build:133.1; macOS(Catalyst) 15.6.1)" -H "accept-language: en-US;q=1.0" --data-binary "{\"unread\":false,\"linkEntityId\":\"f9ff2b03-668f-437b-b764-921f6ae1d8a7\",\"important\":false,\"reminder\":\"ACTIVATED\",\"maxResults\":50,\"status\":\"OPEN\",\"linkType\":\"PATIENT\",\"searchText\":\"\"}" --compressed "https://srvprod.ezinfra.net/ezderm-webservice/rest/task/getByFilter"

# Response
{
	"hasMore": false,
	"tasks": [{
		"id": "638072f2-73e2-4489-b766-facb0bff92b2",
		"active": true,
		"dateCreated": "2025-09-10T15:49:58.48566Z",
		"subject": "Note Deficiencies - 09/08/2025",
		"description": "The following issues were found in the clinical note:\n\n1. Seborrheic dermatitis:\n   Issue: chronicity mismatch\n   HPI: Scalp is occasionally flaking; denies itching; cannot recall how long this has been present.\n   A&P: Seborrheic dermatitis – Problem: Chronic - Moderately Worse; ketoconazole 2% shampoo prescribed.\n   Suggested Correction: Update HPI to document chronicity per CMS (e.g., present ≥12 months or ongoing monitoring), or revise A&P problem status to acute/undetermined if duration is <12 months or unknown.\n\n",
		"status": "OPEN",
		"overdue": false,
		"commentCount": 0,
		"unread": false,
		"important": false,
		"smsSent": false,
		"reminderEnabled": false,
		"links": [{
			"linkType": "PATIENT",
			"linkEntityId": "f9ff2b03-668f-437b-b764-921f6ae1d8a7",
			"description": "Romeka Patton-Lane (ROPA0007)",
			"order": 0
		}],
		"users": [{
			"userType": "WATCHER",
			"userId": "52ce8b70-46ca-11ee-ab7c-19597d6f9cf4",
			"name": "Julie Smith, MA"
		}, {
			"userType": "CREATOR",
			"userId": "dd0c986b-1b6d-4ade-89c8-f2b96d5958cc",
			"name": "Wasim Nasir, MD"
		}, {
			"userType": "WATCHER",
			"userId": "dd0c986b-1b6d-4ade-89c8-f2b96d5958cc",
			"name": "Wasim Nasir, MD"
		}, {
			"userType": "WATCHER",
			"userId": "e3e092b0-21a9-11ef-95c7-37f2c4feb67f",
			"name": "Veronica Ercolani, NP"
		}, {
			"userType": "ASSIGNEE",
			"userId": "f5d41c40-4c1f-11ee-94a6-cfdc50363d2d",
			"name": "Tiffani Vaughan, MA"
		}],
		"attachments": []
	}]
}