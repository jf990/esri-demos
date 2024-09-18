import json
import os
import requests
import sys
import time

AUTH_URL  = "https://www.arcgis.com/sharing/rest/info?f=json"
BATCH_URL = "https://geocode-beta.arcgis.com/arcgis/rest/services/World/GeocodeServer/batchGeocode/beta"

# USER VARIABLES TO CHANGE
ARCGIS_USER = ""
ARCGIS_PASSWORD = ""
PATH = r"E:\Data"
FILE_NAME = "MyZippedCSV.zip"

# multiline geocoding input fields are the following:
# Address,Address2,Address3,Neighborhood,City,Subregion,Region,Postal,PostalExt,CountryCode
# field mapping is <geocodeField1>:<CSV_Field1>, <geocodeField2>:<CSV_Field2>
FIELD_MAPPING = 'Address:Address, City:City, Region:State, Postal:Postal'
# if the entire address is in a single field in the csv, map SingleLine to the field name from your csv
#FIELD_MAPPING = "SingleLine:singleline, CountryCode:countrycode"

def get_token():
    info_response = requests.post(AUTH_URL)
    response_json = info_response.json()
    token_url = response_json["authInfo"]["tokenServicesUrl"]

    params = {
        'username': ARCGIS_USER,
        'password': ARCGIS_PASSWORD,
        'client': 'referer',
        'referer': 'batchGeocode',
        'f': 'json'
        }

    token_response = requests.post(token_url, data=params)
    tokenJson = token_response.json()
    return tokenJson["token"]

def execute():

    use_get = True

    ### need to start by authenticating and using the token in other API calls
    token = get_token()
    print("Token generated: " + token)


    ### first API call uploads the file to the server
    upload_url = BATCH_URL + "/upload"
    filePath = PATH + os.sep + FILE_NAME

    
    # Input file size limit of 2GB.
    # Can't use 'files' parameter for requests because it adds headers to the csv file must use 'data'
    header = {'Content-Type': 'application/binary', 'Content-Disposition': 'attachment; filename={}'.format(FILE_NAME), 'token': token}
    response = requests.put(upload_url, data=open(filePath, 'rb'), headers=header)
    json_upload_response = response.json()
    if json_upload_response.get('error') is not None:
        print(json_upload_response)
        sys.exit()

    itemID = json_upload_response['item']['itemId']
    print("File uploaded: {}".format(FILE_NAME))


    ### second API call submits the job for geocoding
    submit_url = BATCH_URL + "/submitJob"
    params = {
        'fieldMapping': FIELD_MAPPING,
        'itemId': itemID,
        'category': '',
        'sourceCountry': '',
        'matchOutOfRange': '',
        'langCode': '',
        'locationType': '',
        'searchExtent': '',
        'outSR': '',
        'outFields': '*',
        'preferredLabelValues': '',
        'token': token
    }
    if not use_get:
        response = requests.post(submit_url, json=params)
    else:
        response = requests.get(submit_url, params=params)

    json_response = response.json()
    if json_response.get('error') is not None:
        print(json_response)
        sys.exit()

    job_id = json_response['jobId']
    print("Job submitted for geocoding")

    
    ### third API call provides job status
    check_url = BATCH_URL + "/jobs/{}".format(job_id)
    params = {
        'itemId': itemID,
        'token': token
    }

    status = 'esriJobWaiting'
    while status != 'esriJobSucceeded':
        if not use_get:
            response = requests.post(check_url, json=params)
        else:
            response = requests.get(check_url, params=params)

        response_json = response.json()
        #print(response_json)
        status = response_json['jobStatus']
        messages = response_json['messages']
        if messages:
            for message in messages:
                print(status + ": {}".format(message['description']))
        else:
            print(status)
        if status == 'esriJobFailed':
            sys.exit()
        time.sleep(10)
    
    
    ### Job completed! Download the resulting zip file
    success_response_json = response.json()
    param_url = success_response_json['results']['geocodeResult']['paramUrl']
    results_url = check_url + "/" + param_url
    if not use_get:
        response = requests.post(results_url, json=params)
    else:
        response = requests.get(results_url, params=params)

    final_out_response_json = response.json()
    print(final_out_response_json)
    download_url = final_out_response_json['value']['url']
    header = {'token': token}

    local_filename = PATH + os.sep + 'results_{}.zip'.format(str(int(time.time())))
    with requests.get(download_url, headers=header, stream=True) as r:
        r.raise_for_status()
        with open(local_filename, 'wb') as f:
            for chunk in r.iter_content(chunk_size=8192): 
                f.write(chunk)
        
        print("Downloaded output successfully!")


if __name__ == '__main__':
    execute()
