# Backend Connectivity Debugging Guide

## Common Issues and Testing Procedures

### 1. Network Connectivity Issues

#### Symptoms:
- Frontend cannot reach backend endpoints
- Timeout errors
- Connection refused errors

#### Testing Steps:
1. **Check if backend service is running:**
   ```bash
   curl -v http://localhost:3000/health
   ```
   Replace port with your backend's port

2. **Test network connectivity:**
   ```bash
   ping your-backend-domain.com
   ```

3. **Check firewall settings:**
   ```bash
   sudo ufw status
   ```

### 2. CORS Issues

#### Symptoms:
- Browser console shows CORS errors
- Preflight requests failing
- "Access-Control-Allow-Origin" errors

#### Testing Steps:
1. **Check CORS headers in response:**
   ```bash
   curl -v -X OPTIONS http://your-backend-domain.com/api/endpoint
   ```

2. **Verify CORS configuration in backend**
   - Check if proper headers are set
   - Verify allowed origins match your frontend domain

### 3. Environment Configuration Issues

#### Symptoms:
- Backend URLs not resolving
- Environment variables not loading
- Different behavior between environments

#### Testing Steps:
1. **Verify environment variables:**
   ```bash
   # Check .env file
   cat .env
   
   # Check environment variables in runtime
   printenv | grep BACKEND
   ```

2. **Test API endpoints with correct environment:**
   ```bash
   curl -v http://${BACKEND_URL}/api/health
   ```

### 4. SSL/TLS Issues

#### Symptoms:
- Mixed content warnings
- SSL certificate errors
- HTTPS connection failures

#### Testing Steps:
1. **Check SSL certificate:**
   ```bash
   openssl s_client -connect your-backend-domain.com:443
   ```

2. **Verify certificate chain:**
   ```bash
   curl -v https://your-backend-domain.com
   ```

### 5. Load Balancer/Proxy Issues

#### Symptoms:
- Inconsistent connectivity
- 502/504 errors
- Connection timeouts

#### Testing Steps:
1. **Check load balancer health:**
   ```bash
   curl -v http://your-load-balancer/health
   ```

2. **Verify proxy configuration:**
   - Check Nginx/Apache logs
   - Verify proxy_pass settings

### 6. Database Connectivity

#### Symptoms:
- Backend service starts but cannot connect to database
- Database connection timeouts
- Authentication failures

#### Testing Steps:
1. **Test database connection:**
   ```bash
   # For MongoDB
   mongosh "mongodb://your-connection-string"
   
   # For PostgreSQL
   psql "postgresql://user:password@host:port/dbname"
   ```

2. **Check database logs:**
   ```bash
   tail -f /var/log/mongodb/mongod.log
   ```

### 7. WebSocket Issues

#### Symptoms:
- WebSocket connection failures
- Connection drops
- Handshake failures

#### Testing Steps:
1. **Test WebSocket connection:**
   ```bash
   wscat -c ws://your-websocket-server:port
   ```

2. **Check WebSocket server status:**
   ```bash
   netstat -tulpn | grep :port
   ```

## General Debugging Tips

1. **Check Logs:**
   - Frontend console logs
   - Backend application logs
   - Server error logs
   - Network logs in browser dev tools

2. **Network Analysis:**
   - Use browser dev tools Network tab
   - Check request/response headers
   - Monitor WebSocket frames

3. **Performance Monitoring:**
   - Check response times
   - Monitor memory usage
   - Track CPU utilization

4. **Security Checks:**
   - Verify authentication tokens
   - Check API key validity
   - Validate session cookies

## Common Solutions

1. **For CORS issues:**
   - Ensure proper CORS headers in backend
   - Verify allowed origins
   - Check preflight request handling

2. **For network issues:**
   - Verify firewall rules
   - Check DNS resolution
   - Test with different networks

3. **For SSL issues:**
   - Update SSL certificates
   - Verify certificate chain
   - Check SSL configuration

4. **For database issues:**
   - Verify connection strings
   - Check database permissions
   - Monitor database resources

Remember to document any changes made during debugging and keep track of successful solutions for future reference.

## Node.js Specific Deployment Debugging

### Local Debugging – Before Deployment

#### 1. Production-like Environment Testing
```bash
# Run in production mode
NODE_ENV=production node index.js

# Or with PM2
pm2 start index.js --env production
```

#### 2. Environment Variables Verification
```bash
# Test with environment variables
env $(cat .env | xargs) node index.js
```

#### 3. Comprehensive Logging
Add these key logging points:
- Server initialization
- Port binding
- Database connections
- Error handlers
- External API calls

#### 4. Local Reverse Proxy Testing
- Set up nginx locally
- Test with Express-based proxy
- Verify headers, paths, and CORS

#### 5. Container Testing
- Package app in Docker
- Test in local VM
- Simulate AWS environment

### Server-Side Debugging (AWS)

#### 1. Manual Server Testing
```bash
ssh ubuntu@your-server
cd /your/app/folder
npm install
npm start
```

#### 2. Process Monitoring
```bash
# PM2 logs
pm2 logs

# Or check nohup output
tail -f nohup.out
```

#### 3. Port Binding Verification
```bash
# Check listening ports
netstat -tulnp | grep node
# Or
lsof -i -P -n | grep LISTEN
```

Important: Ensure your app binds to `0.0.0.0` not `localhost` for external access.

#### 4. Firewall Configuration
```bash
# Check AWS security groups
# Configure local firewall
sudo ufw allow 3000
```

#### 5. Reverse Proxy Setup
```bash
# Check nginx configuration
cat /etc/nginx/sites-available/default
sudo nginx -t
```

### Node.js Version Management
```bash
# Match server Node version
nvm install x.x.x
```

### Quick Test Script
```javascript
// test.js
console.log("Node is working!");
```
```bash
node test.js
``` 