# Get Practice and Providers

curl 'https://srvprod.ezinfra.net/ezderm-webservice/rest/practice/getPracticeAndProvidersForEligibilitySettings' \
  -H 'accept: application/json' \
  -H 'accept-language: en-US,en;q=0.9' \
  -H 'authorization: Bearer eyJhbGciOiJFUzI1NiIsInR5cCI6IkpXVCJ9.eyJpYXQiOjE3NTc2NDI5NTYsImV4cCI6MTc1NzY0MzU1NiwibiI6ImRyZ2pva2EiLCJhIjo0LCJ1IjoiMjkzYTFiNjAtNWFjMC0xMWYwLTk5NTUtNmZiM2ZiODFkZWY3IiwicCI6IjRjYzk2OTIyLTRkODMtNDE4My04NjNiLTc0OGQ2OWRlNjIxZiIsImQiOiIwMTM4MSIsInoiOiJBbWVyaWNhL0RldHJvaXQiLCJnIjoiOWU1MjIzMjctMzhkZi00YWUxLWJlMWUtMzVjMzdmYWUyMmI3IiwicyI6NDcwMzk4MywidCI6Miwic3IiOjM1NjN9.4-PZYf7RbETmIEix_qaQsB_fjoM_bCAdG-kYvJThepelb-QtKXmReI5vVqKY7WrfVqNPy2_1uKUIkkDu11I4uA' \
  -H 'content-type: application/json' \
  -H 'origin: https://pms.ezderm.com' \
  -H 'priority: u=1, i' \
  -H 'referer: https://pms.ezderm.com/' \
  -H 'sec-ch-ua: "Chromium";v="140", "Not=A?Brand";v="24", "Google Chrome";v="140"' \
  -H 'sec-ch-ua-mobile: ?0' \
  -H 'sec-ch-ua-platform: "macOS"' \
  -H 'sec-fetch-dest: empty' \
  -H 'sec-fetch-mode: cors' \
  -H 'sec-fetch-site: cross-site' \
  -H 'user-agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36'

# Response
[
    {
        "defaultPracticeOrProviderId": "4cc96922-4d83-4183-863b-748d69de621f",
        "eligibilityCheckEntity": "PRACTICE",
        "defaultPracticeOrProviderDescription": "DERMATOLOGY & COSMETIC CENTER PLLC"
    },
    {
        "defaultPracticeOrProviderId": "293a1b60-5ac0-11f0-9955-6fb3fb81def7",
        "eligibilityCheckEntity": "PROVIDER",
        "defaultPracticeOrProviderDescription": "Enea Gjoka"
    },
    {
        "defaultPracticeOrProviderId": "5803c9d0-898e-11f0-b033-87536b539276",
        "eligibilityCheckEntity": "PROVIDER",
        "defaultPracticeOrProviderDescription": "Tyler D Menge"
    },
    {
        "defaultPracticeOrProviderId": "76c841e0-b3db-11ef-84c6-c5d62f84bd76",
        "eligibilityCheckEntity": "PROVIDER",
        "defaultPracticeOrProviderDescription": "Kaitlyn Davidson, PA-C"
    },
    {
        "defaultPracticeOrProviderId": "b2858680-05b5-11f0-bfac-c75c9a885bee",
        "eligibilityCheckEntity": "PROVIDER",
        "defaultPracticeOrProviderDescription": "Halimeh Farhat, PA-C"
    },
    {
        "defaultPracticeOrProviderId": "d8d29690-05b3-11f0-bfac-c75c9a885bee",
        "eligibilityCheckEntity": "PROVIDER",
        "defaultPracticeOrProviderDescription": "Henna Shah, NP"
    },
    {
        "defaultPracticeOrProviderId": "dd0c986b-1b6d-4ade-89c8-f2b96d5958cc",
        "eligibilityCheckEntity": "PROVIDER",
        "defaultPracticeOrProviderDescription": "Wasim Nasir, MD"
    },
    {
        "defaultPracticeOrProviderId": "e3e092b0-21a9-11ef-95c7-37f2c4feb67f",
        "eligibilityCheckEntity": "PROVIDER",
        "defaultPracticeOrProviderDescription": "Veronica Ercolani, NP"
    },
    {
        "defaultPracticeOrProviderId": "fedfa2f0-3ff2-11f0-bed0-87828086803b",
        "eligibilityCheckEntity": "PROVIDER",
        "defaultPracticeOrProviderDescription": "Lesli Uvario-Romo, PA-C"
    }
]

# Get Active Patient Insurance Profiles
curl 'https://srvprod.ezinfra.net/ezderm-webservice/rest/insurance/getActivePatientInsuranceProfile/_rid/cc42525a-6ee1-4124-b77b-c663a6945780' \
  -H 'accept: application/json' \
  -H 'accept-language: en-US,en;q=0.9' \
  -H 'authorization: Bearer eyJhbGciOiJFUzI1NiIsInR5cCI6IkpXVCJ9.eyJpYXQiOjE3NTc2NDI5NTYsImV4cCI6MTc1NzY0MzU1NiwibiI6ImRyZ2pva2EiLCJhIjo0LCJ1IjoiMjkzYTFiNjAtNWFjMC0xMWYwLTk5NTUtNmZiM2ZiODFkZWY3IiwicCI6IjRjYzk2OTIyLTRkODMtNDE4My04NjNiLTc0OGQ2OWRlNjIxZiIsImQiOiIwMTM4MSIsInoiOiJBbWVyaWNhL0RldHJvaXQiLCJnIjoiOWU1MjIzMjctMzhkZi00YWUxLWJlMWUtMzVjMzdmYWUyMmI3IiwicyI6NDcwMzk4MywidCI6Miwic3IiOjM1NjN9.4-PZYf7RbETmIEix_qaQsB_fjoM_bCAdG-kYvJThepelb-QtKXmReI5vVqKY7WrfVqNPy2_1uKUIkkDu11I4uA' \
  -H 'content-type: application/json' \
  -H 'origin: https://pms.ezderm.com' \
  -H 'patientid: cc42525a-6ee1-4124-b77b-c663a6945780' \
  -H 'priority: u=1, i' \
  -H 'referer: https://pms.ezderm.com/' \
  -H 'sec-ch-ua: "Chromium";v="140", "Not=A?Brand";v="24", "Google Chrome";v="140"' \
  -H 'sec-ch-ua-mobile: ?0' \
  -H 'sec-ch-ua-platform: "macOS"' \
  -H 'sec-fetch-dest: empty' \
  -H 'sec-fetch-mode: cors' \
  -H 'sec-fetch-site: cross-site' \
  -H 'user-agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36'
  
# Responses
{
    "activePatientInsuranceProfiles": [
        {
            "id": "65c9c9a2-c458-4628-b31e-358950ac7a6a",
            "patientName": "Henry Gjoka",
            "patientId": "cc42525a-6ee1-4124-b77b-c663a6945780",
            "patientDateOfBirth": "2020-06-09",
            "insurancePolicies": [],
            "active": true,
            "selfPay": false
        },
        {
            "id": "f52f0417-8d2b-4355-bdba-7d28053430ae",
            "patientName": "Henry Gjoka",
            "patientId": "cc42525a-6ee1-4124-b77b-c663a6945780",
            "patientDateOfBirth": "2020-06-09",
            "insurancePolicies": [
                {
                    "id": "087b5490-8f3e-11f0-a64c-fdaadd799bdc",
                    "memberNumber": "YVA250096871",
                    "insuranceNote": "",
                    "insurancePolicyType": {
                        "id": "be02b22c-0e6a-4a77-b403-637507bb7200",
                        "active": true,
                        "type": "BLUE_CROSS_BLUE_SHIELD",
                        "description": "Blue Cross/Blue Shield",
                        "code": "BL"
                    },
                    "relationshipToResponsiblePerson": "CHILD",
                    "groupName": "10064094",
                    "validFrom": "2025-09-01T12:00:00+00:00",
                    "validThrough": "",
                    "responsibleFirstName": "Enea",
                    "responsibleLastName": "Gjoka",
                    "responsibleGender": "MALE",
                    "responsibleDateOfBirth": "1989-09-06",
                    "responsiblePhone": "3135209727",
                    "addressInformation": {
                        "id": "809183b7-b211-416e-b9b9-fff1f92299fa",
                        "dateModified": "2025-09-11T18:35:05.238+00:00",
                        "active": true,
                        "streetAddressLn1": "22264 Chase Dr",
                        "city": "Novi",
                        "state": "MICHIGAN",
                        "country": "UNITED_STATES",
                        "zip": "48375",
                        "poBox": false
                    },
                    "insuranceCompany": {
                        "id": "f98c2402-0177-45a1-a94f-0b1c6429f238",
                        "name": "Blue Cross Blue Shield of Michigan",
                        "type": "PRIVATE",
                        "practiceId": "4cc96922-4d83-4183-863b-748d69de621f",
                        "contactInfoList": [],
                        "addressInformationInfo": {
                            "id": "54bbf23e-430e-4109-a5bc-823ab983096d",
                            "dateModified": "2022-12-23T13:55:59.768+00:00",
                            "active": true,
                            "poBox": false
                        },
                        "senderNumber": "00710A",
                        "deprecated": false,
                        "requireAdditionalCodeValue": false,
                        "msrrType": "MEDICARE",
                        "authorizationNeeded": false,
                        "referralNeeded": false,
                        "parentId": "eb97bc1c-0caf-4637-b2b2-dbc931353164"
                    },
                    "dateCreated": "2025-09-11T18:35:05.123539Z",
                    "order": 1,
                    "eligibilityStatus": "ELIGIBLE",
                    "eligibilityId": "383c6939-b074-458e-a71f-16cc58935228",
                    "eligibilityDate": "2025-09-12",
                    "pastEligibilityStatus": "ELIGIBLE",
                    "pastEligibilityId": "383c6939-b074-458e-a71f-16cc58935228",
                    "pastEligibilityDate": "2025-09-12",
                    "authorizationNeeded": false,
                    "referralNeeded": false,
                    "hasActiveAuthorization": false
                }
            ],
            "active": true,
            "selfPay": false
        }
    ],
    "inactivePatientInsuranceProfiles": []
}

# Get Eligibility Check History
curl 'https://srvprod.ezinfra.net/ezderm-webservice/rest/insurance/getEligibility' \
  -H 'accept: application/json' \
  -H 'accept-language: en-US,en;q=0.9' \
  -H 'authorization: Bearer eyJhbGciOiJFUzI1NiIsInR5cCI6IkpXVCJ9.eyJpYXQiOjE3NTc2NDI5NTYsImV4cCI6MTc1NzY0MzU1NiwibiI6ImRyZ2pva2EiLCJhIjo0LCJ1IjoiMjkzYTFiNjAtNWFjMC0xMWYwLTk5NTUtNmZiM2ZiODFkZWY3IiwicCI6IjRjYzk2OTIyLTRkODMtNDE4My04NjNiLTc0OGQ2OWRlNjIxZiIsImQiOiIwMTM4MSIsInoiOiJBbWVyaWNhL0RldHJvaXQiLCJnIjoiOWU1MjIzMjctMzhkZi00YWUxLWJlMWUtMzVjMzdmYWUyMmI3IiwicyI6NDcwMzk4MywidCI6Miwic3IiOjM1NjN9.4-PZYf7RbETmIEix_qaQsB_fjoM_bCAdG-kYvJThepelb-QtKXmReI5vVqKY7WrfVqNPy2_1uKUIkkDu11I4uA' \
  -H 'content-type: application/json' \
  -H 'origin: https://pms.ezderm.com' \
  -H 'priority: u=1, i' \
  -H 'referer: https://pms.ezderm.com/' \
  -H 'sec-ch-ua: "Chromium";v="140", "Not=A?Brand";v="24", "Google Chrome";v="140"' \
  -H 'sec-ch-ua-mobile: ?0' \
  -H 'sec-ch-ua-platform: "macOS"' \
  -H 'sec-fetch-dest: empty' \
  -H 'sec-fetch-mode: cors' \
  -H 'sec-fetch-site: cross-site' \
  -H 'user-agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36' \
  --data-raw '{"id":"087b5490-8f3e-11f0-a64c-fdaadd799bdc","type":"POLICY"}'

  # Response

  [
    {
        "date": "2025-09-11",
        "eligibilityList": [
            {
                "date": "2025-09-11",
                "requestedBy": "Aaron Bogdanowicz",
                "eligibilityId": "567b60c2-369a-4d14-bb18-4c607d2e5aac",
                "eligibilityStatus": "ELIGIBLE",
                "policyName": "Blue Cross Blue Shield of Michigan",
                "dateRequested": "2025-09-11T18:35:06.64236Z"
            },
            {
                "date": "2025-09-11",
                "requestedBy": "Enea Gjoka",
                "eligibilityId": "9709c804-da23-4ee0-b49b-bfe64f475e17",
                "eligibilityStatus": "ELIGIBLE",
                "policyName": "Blue Cross Blue Shield of Michigan",
                "dateRequested": "2025-09-11T18:39:36.836858Z"
            }
        ]
    },
    {
        "date": "2025-09-12",
        "eligibilityList": [
            {
                "date": "2025-09-12",
                "requestedBy": "Enea Gjoka",
                "eligibilityId": "383c6939-b074-458e-a71f-16cc58935228",
                "eligibilityStatus": "ELIGIBLE",
                "policyName": "Blue Cross Blue Shield of Michigan",
                "dateRequested": "2025-09-12T02:09:16.310271Z"
            }
        ]
    }
]

# Check Benefits as Provider
curl 'https://srvprod.ezinfra.net/ezderm-webservice/rest/patient/checkEligibility' \
  -H 'accept: application/json' \
  -H 'accept-language: en-US,en;q=0.9' \
  -H 'authorization: Bearer eyJhbGciOiJFUzI1NiIsInR5cCI6IkpXVCJ9.eyJpYXQiOjE3NTc2MTU5NDQsImV4cCI6MTc1NzYxNjU0NCwibiI6ImRyZ2pva2EiLCJhIjo0LCJ1IjoiMjkzYTFiNjAtNWFjMC0xMWYwLTk5NTUtNmZiM2ZiODFkZWY3IiwicCI6IjRjYzk2OTIyLTRkODMtNDE4My04NjNiLTc0OGQ2OWRlNjIxZiIsImQiOiIwMTM4MSIsInoiOiJBbWVyaWNhL0RldHJvaXQiLCJnIjoiOWU1MjIzMjctMzhkZi00YWUxLWJlMWUtMzVjMzdmYWUyMmI3IiwicyI6NDcwMzk4MywidCI6Miwic3IiOjM1NjN9.zoHPSVfLhUFdVoR51OVjVXqQuj556vrAtTl6Q6-IHemqz4gx_y-dwAyf1QBhodozU1AzdbijOdpx0nYT9kyi4g' \
  -H 'content-type: application/json' \
  -H 'origin: https://pms.ezderm.com' \
  -H 'priority: u=1, i' \
  -H 'referer: https://pms.ezderm.com/' \
  -H 'sec-ch-ua: "Chromium";v="140", "Not=A?Brand";v="24", "Google Chrome";v="140"' \
  -H 'sec-ch-ua-mobile: ?0' \
  -H 'sec-ch-ua-platform: "macOS"' \
  -H 'sec-fetch-dest: empty' \
  -H 'sec-fetch-mode: cors' \
  -H 'sec-fetch-site: cross-site' \
  -H 'user-agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36' \
  --data-raw '{"patientEligibilityCheckInfoRequestList":[{"id":"f52f0417-8d2b-4355-bdba-7d28053430ae","dateForEligibilityCheck":"2025-09-11T18:39:36.722Z","type":"PROFILE"}],"id":"dd0c986b-1b6d-4ade-89c8-f2b96d5958cc","type":"PROVIDER"}'

  # Response
  [
    {
        "id": "f52f0417-8d2b-4355-bdba-7d28053430ae",
        "eligibilityStatusValue": "PENDING_RESPONSE"
    }
]

# Check Benefits as Practice
curl 'https://srvprod.ezinfra.net/ezderm-webservice/rest/patient/checkEligibility' \
  -H 'accept: application/json' \
  -H 'accept-language: en-US,en;q=0.9' \
  -H 'authorization: Bearer eyJhbGciOiJFUzI1NiIsInR5cCI6IkpXVCJ9.eyJpYXQiOjE3NTc2NDI5NTYsImV4cCI6MTc1NzY0MzU1NiwibiI6ImRyZ2pva2EiLCJhIjo0LCJ1IjoiMjkzYTFiNjAtNWFjMC0xMWYwLTk5NTUtNmZiM2ZiODFkZWY3IiwicCI6IjRjYzk2OTIyLTRkODMtNDE4My04NjNiLTc0OGQ2OWRlNjIxZiIsImQiOiIwMTM4MSIsInoiOiJBbWVyaWNhL0RldHJvaXQiLCJnIjoiOWU1MjIzMjctMzhkZi00YWUxLWJlMWUtMzVjMzdmYWUyMmI3IiwicyI6NDcwMzk4MywidCI6Miwic3IiOjM1NjN9.4-PZYf7RbETmIEix_qaQsB_fjoM_bCAdG-kYvJThepelb-QtKXmReI5vVqKY7WrfVqNPy2_1uKUIkkDu11I4uA' \
  -H 'content-type: application/json' \
  -H 'origin: https://pms.ezderm.com' \
  -H 'priority: u=1, i' \
  -H 'referer: https://pms.ezderm.com/' \
  -H 'sec-ch-ua: "Chromium";v="140", "Not=A?Brand";v="24", "Google Chrome";v="140"' \
  -H 'sec-ch-ua-mobile: ?0' \
  -H 'sec-ch-ua-platform: "macOS"' \
  -H 'sec-fetch-dest: empty' \
  -H 'sec-fetch-mode: cors' \
  -H 'sec-fetch-site: cross-site' \
  -H 'user-agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36' \
  --data-raw '{"patientEligibilityCheckInfoRequestList":[{"id":"f52f0417-8d2b-4355-bdba-7d28053430ae","dateForEligibilityCheck":"2025-09-12T02:09:15.174Z","type":"PROFILE"}],"id":"4cc96922-4d83-4183-863b-748d69de621f","type":"PRACTICE"}'

  # Response

  [
    {
        "id": "f52f0417-8d2b-4355-bdba-7d28053430ae",
        "eligibilityStatusValue": "PENDING_RESPONSE"
    }
]