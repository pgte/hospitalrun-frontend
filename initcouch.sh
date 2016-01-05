#!/bin/bash
if [ -z "${1}" ] || [ -z "${2}" ]; then
    HOST="http://127.0.0.1:5984"
    curl -X PUT $HOST/_config/admins/couchadmin -d '"test"'
    SECUREHOST="http://couchadmin:test@127.0.0.1:5984"
else
    SECUREHOST="http://$1:$2@127.0.0.1:5984"
fi
curl -X PUT $SECUREHOST/_users/_security -d '{ "admins": { "names": [], "roles": ["admin"]}, "members": { "names": [], "roles": []}}'
curl -X PUT $SECUREHOST/config
curl -X PUT $SECUREHOST/config/_security -d '{ "admins": { "names": [], "roles": ["admin"]}, "members": { "names": [], "roles": []}}'
curl -X PUT $SECUREHOST/main
curl -X PUT $SECUREHOST/main/_security -d '{ "admins": { "names": [], "roles": ["admin"]}, "members": { "names": [], "roles": ["user"]}}'
curl -X PUT $SECUREHOST/_config/http/authentication_handlers -d '"{couch_httpd_oauth, oauth_authentication_handler}, {couch_httpd_auth, proxy_authentification_handler}, {couch_httpd_auth, cookie_authentication_handler}, {couch_httpd_auth, default_authentication_handler}"'
curl -X PUT $SECUREHOST/_config/couch_httpd_oauth/use_users_db -d '"true"'
curl -X PUT $SECUREHOST/_users/org.couchdb.user:hradmin -d '{"name": "hradmin", "password": "test", "roles": ["System Administrator","admin","user"], "type": "user", "userPrefix": "p1"}'

main="${SECUREHOST}/main"
curl -X PUT "${main}/_design/filters" -d "{ \"filters\": { \"filter_docs_for_role\": \"function() { return true; }\" } }"

ROLES=( business-office cashier data-entry doctor finance finance-manager hospital-administrator inventory-manager imaging-technician lab-technician medical-records-officer nurse nurse-manager patient-administration pharmacist social-worker system-administrator user-administrator )

for role in "${ROLES[@]}"
do
  echo "db for role ${role}"
  target="${SECUREHOST}/${role}"
  curl -X PUT "${target}"
  curl -X PUT "${target}/_security" -d "{ \"admins\": { \"names\": [], \"roles\": [\"admin\"]}, \"members\": { \"names\": [], \"roles\": [\"user\", \"${role}\"]}}"
  curl -X PUT "${target}/_design/filters" -d "{ \"filters\": { \"filter_docs_for_role\": \"function() { return true; }\" } }"
  curl -X POST "${SECUREHOST}/_replicate" -d "{ \"_id\": \"main_to_${role}\", \"source\": \"${main}\", \"target\": \"${target}\", \"continuous\": true, \"filter\": \"filters/filter_docs_for_role\", \"query_params\": { \"role\": \"${role}\" } }" -H "content-type: application/json"
  curl -X POST "${SECUREHOST}/_replicate" -d "{ \"_id\": \"${role}_to_main\", \"source\": \"${target}\", \"target\": \"${main}\", \"continuous\": true, \"filter\": \"filters/filter_docs_for_role\", \"query_params\": { \"role\": \"${role}\" } }" -H "content-type: application/json"
done
