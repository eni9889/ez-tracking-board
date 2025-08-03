#!/usr/bin/env node

// Configuration
const CONFIG = {
  // Login credentials
  username: 'wnasir',
  password: 'Dccderm$12',
  
  // API endpoints
  loginUrl: 'https://login.ezinfra.net/api/login',
  apiBaseUrl: 'https://srvprod.ezinfra.net/ezderm-webservice/rest/biopsyLog',
  
  // Provider and date settings
  providerId: 'dd0c986b-1b6d-4ade-89c8-f2b96d5958cc',
  dateFrom: '2023-01-01T00:00:00-0500',
  dateTo: '2025-07-14T23:59:59-0500',
  limit: 10,
  dryRun: false // Set to true to preview what would be resolved
};

// Store authentication tokens
let authTokens = null;

/**
 * Login to EZDerm API and get access tokens
 */
async function login() {
  const loginData = {
    username: CONFIG.username,
    password: CONFIG.password,
    application: 'EZDERM',
    timeZoneId: 'America/Detroit',
    clientVersion: '4.28.0'
  };

  try {
    console.log('🔐 Logging in to EZDerm API...');
    
    const response = await fetch(CONFIG.loginUrl, {
      method: 'POST',
      headers: {
        'Host': 'login.ezinfra.net',
        'accept': 'application/json',
        'content-type': 'application/json',
        'user-agent': 'ezDerm/4.28.0 (com.ezderm.ezderm; build:132.19; macOS(Catalyst) 15.5.0) Alamofire/5.10.2',
        'accept-language': 'en-US;q=1.0'
      },
      body: JSON.stringify(loginData)
    });

    if (!response.ok) {
      const errorData = await response.text();
      throw new Error(`Login failed: ${response.status} - ${errorData}`);
    }

    const loginResult = await response.json();
    authTokens = {
      accessToken: loginResult.accessToken,
      refreshToken: loginResult.refreshToken,
      serverUrl: loginResult.servers.app,
      timestamp: Date.now()
    };

    console.log('✅ Successfully logged in to EZDerm API');
    console.log(`🌐 Server URL: ${authTokens.serverUrl}`);
    
    return authTokens;
  } catch (error) {
    console.error('❌ Login failed:', error.message);
    throw error;
  }
}

/**
 * Check if token is expired (10 minutes)
 */
function isTokenExpired() {
  if (!authTokens) return true;
  const TOKEN_EXPIRY_MS = 600000; // 10 minutes
  return Date.now() - authTokens.timestamp > TOKEN_EXPIRY_MS;
}

/**
 * Get headers for authenticated API requests
 */
function getAuthenticatedHeaders() {
  if (!authTokens) {
    throw new Error('Not authenticated - please login first');
  }
  
  return {
    'Host': 'srvprod.ezinfra.net',
    'accept': 'application/json',
    'content-type': 'application/json',
    'authorization': `Bearer ${authTokens.accessToken}`,
    'user-agent': 'ezDerm/4.28.0 (build:132.19; macOS(Catalyst) 15.5.0)',
    'accept-language': 'en-US;q=1.0'
  };
}

/**
 * Fetch biopsy logs from API with pagination
 */
async function fetchBiopsyLogs(lastOrderId = null, lastOrderDateCreated = null) {
  // Check if we need to login or refresh token
  if (isTokenExpired()) {
    await login();
  }

  const requestBody = {
    favorite: false,
    resolved: 'UNRESOLVED',
    late: false,
    status: 'PENDING_REVIEW',
    providerId: CONFIG.providerId,
    dateFrom: CONFIG.dateFrom,
    dateTo: CONFIG.dateTo,
    limit: CONFIG.limit
  };

  // Add pagination parameters if provided
  if (lastOrderId && lastOrderDateCreated) {
    requestBody.lastOrderId = lastOrderId;
    requestBody.lastOrderDateCreated = lastOrderDateCreated;
  }

  try {
    console.log(`🔍 Fetching biopsy logs${lastOrderId ? ' (next page)' : ''}...`);
    
    const response = await fetch(`${CONFIG.apiBaseUrl}/getBiopsyLogByFilter`, {
      method: 'POST',
      headers: getAuthenticatedHeaders(),
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      if (response.status === 401) {
        console.log('🔄 Token expired, re-authenticating...');
        await login();
        // Retry with new token
        return fetchBiopsyLogs(lastOrderId, lastOrderDateCreated);
      }
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    console.log(`✅ Fetched ${data.patientWrapperInfos?.length || 0} patients, hasMore: ${data.hasMore}`);
    
    return data;
  } catch (error) {
    console.error('❌ Error fetching biopsy logs:', error.message);
    throw error;
  }
}

/**
 * Extract unresolved biopsies from API response
 */
function extractUnresolvedBiopsies(data) {
  const unresolvedBiopsies = [];
  
  if (!data.patientWrapperInfos) {
    return unresolvedBiopsies;
  }
  
  data.patientWrapperInfos.forEach(patient => {
    if (!patient.inboxItems) return;
    
    patient.inboxItems.forEach(item => {
      if (item.type === 'PATHOLOGY' && item.biopsyResolved === false) {
        unresolvedBiopsies.push({
          inboxId: item.id,
          patientId: patient.id,
          patientName: `${patient.firstName} ${patient.lastName}`,
          description: item.description,
          biopsyLabelNumber: item.biopsyLabelNumber,
          diagnosis: item.diagnosis,
          locationName: item.locationName,
          procedureName: item.procedureName,
          dateDiagnosed: item.dateDiagnosed,
          phaseName: item.phaseName
        });
      }
    });
  });
  
  return unresolvedBiopsies;
}

/**
 * Resolve a single biopsy via API
 */
async function resolveBiopsy(biopsy) {
  // Check if we need to refresh token
  if (isTokenExpired()) {
    await login();
  }

  const requestBody = {
    value: true,
    inboxId: biopsy.inboxId
  };
  
  const headers = {
    ...getAuthenticatedHeaders(),
    'patientid': biopsy.patientId
  };
  
  try {
    const response = await fetch(`${CONFIG.apiBaseUrl}/setBiopsyResolved`, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify(requestBody)
    });
    
    if (!response.ok) {
      if (response.status === 401) {
        console.log('🔄 Token expired during resolution, re-authenticating...');
        await login();
        // Retry with new token
        return resolveBiopsy(biopsy);
      }
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const result = await response.json();
    return result;
  } catch (error) {
    console.error(`❌ Error resolving biopsy ${biopsy.inboxId}:`, error.message);
    return null;
  }
}

/**
 * Get pagination info for next page
 */
function getPaginationInfo(data) {
  if (!data.hasMore || !data.patientWrapperInfos || data.patientWrapperInfos.length === 0) {
    return null;
  }
  
  // Get the last patient's order info for pagination
  const lastPatient = data.patientWrapperInfos[data.patientWrapperInfos.length - 1];
  if (!lastPatient.orders || lastPatient.orders.length === 0) {
    return null;
  }
  
  const lastOrder = lastPatient.orders[lastPatient.orders.length - 1];
  return {
    lastOrderId: lastOrder.id,
    lastOrderDateCreated: lastOrder.dateCreated
  };
}

/**
 * Main execution function
 */
async function main() {
  console.log('🚀 Starting biopsy resolution script with authentication...\n');
  
  let totalResolved = 0;
  let totalErrors = 0;
  let totalProcessed = 0;
  let pageNumber = 1;
  let lastOrderId = null;
  let lastOrderDateCreated = null;
  
  try {
    // Initial login
    await login();
    
    do {
      console.log(`\n📄 Processing page ${pageNumber}...`);
      
      // Fetch biopsy logs for current page
      const data = await fetchBiopsyLogs(lastOrderId, lastOrderDateCreated);
      
      // Extract unresolved biopsies from this page
      const unresolvedBiopsies = extractUnresolvedBiopsies(data);
      
      console.log(`📋 Found ${unresolvedBiopsies.length} unresolved biopsies on page ${pageNumber}`);
      
      if (unresolvedBiopsies.length > 0) {
        // Display biopsies found on this page
        unresolvedBiopsies.forEach((biopsy, index) => {
          console.log(`  ${index + 1}. ${biopsy.patientName} - ${biopsy.biopsyLabelNumber || 'N/A'} (${biopsy.locationName || 'N/A'})`);
        });
        
        if (!CONFIG.dryRun) {
          console.log(`\n🔄 Resolving ${unresolvedBiopsies.length} biopsies from page ${pageNumber}...`);
          
          // Process each biopsy
          for (let i = 0; i < unresolvedBiopsies.length; i++) {
            const biopsy = unresolvedBiopsies[i];
            console.log(`  Processing ${i + 1}/${unresolvedBiopsies.length}: ${biopsy.patientName}...`);
            
            const result = await resolveBiopsy(biopsy);
            
            if (result) {
              console.log(`  ✅ Successfully resolved biopsy for ${biopsy.patientName}`);
              totalResolved++;
            } else {
              console.log(`  ❌ Failed to resolve biopsy for ${biopsy.patientName}`);
              totalErrors++;
            }
            
            totalProcessed++;
            
            // Add delay between API calls
            if (i < unresolvedBiopsies.length - 1) {
              await new Promise(resolve => setTimeout(resolve, 500));
            }
          }
        } else {
          console.log(`\n🔍 DRY RUN: Would resolve ${unresolvedBiopsies.length} biopsies from page ${pageNumber}`);
          totalProcessed += unresolvedBiopsies.length;
        }
      }
      
      // Get pagination info for next page
      const paginationInfo = getPaginationInfo(data);
      
      if (data.hasMore && paginationInfo) {
        lastOrderId = paginationInfo.lastOrderId;
        lastOrderDateCreated = paginationInfo.lastOrderDateCreated;
        pageNumber++;
        
        // Add delay between pages
        console.log('\n⏳ Moving to next page...');
        await new Promise(resolve => setTimeout(resolve, 1000));
      } else {
        console.log('\n✅ No more pages to process');
        break;
      }
      
    } while (true);
    
  } catch (error) {
    console.error('💥 Script failed:', error.message);
    process.exit(1);
  }
  
  // Final summary
  console.log('\n📊 Final Summary:');
  console.log(`📄 Pages processed: ${pageNumber}`);
  console.log(`📋 Total biopsies found: ${totalProcessed}`);
  
  if (!CONFIG.dryRun) {
    console.log(`✅ Successfully resolved: ${totalResolved}`);
    console.log(`❌ Failed to resolve: ${totalErrors}`);
    
    if (totalResolved === totalProcessed) {
      console.log('\n🎉 All biopsies have been successfully resolved!');
    } else if (totalErrors > 0) {
      console.log('\n⚠️  Some biopsies failed to resolve. Check the error messages above.');
    }
  } else {
    console.log('\n🔍 DRY RUN completed - no actual resolutions were made');
  }
}

// Check if fetch is available (Node.js 18+)
if (typeof fetch === 'undefined') {
  console.error('❌ This script requires Node.js 18+ for native fetch support');
  console.log('Please upgrade Node.js or install node-fetch package');
  process.exit(1);
}

// Run the script
main().catch(error => {
  console.error('💥 Script failed with error:', error.message);
  process.exit(1);
});
