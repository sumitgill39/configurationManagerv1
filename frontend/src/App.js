import React, { useState, useCallback } from 'react';

const API_BASE = 'http://localhost:18080/api';

const ConfigurationManager = () => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  
  // Configuration Wizard State
  const [currentFile, setCurrentFile] = useState(null);
  const [fileContent, setFileContent] = useState('');
  const [configData, setConfigData] = useState([]);
  const [selectedEnvironment, setSelectedEnvironment] = useState('');
  const [savedConfigs, setSavedConfigs] = useState({});
  const [appName, setAppName] = useState('');
  const [version, setVersion] = useState('');
  const [step2Visible, setStep2Visible] = useState(false);
  const [step3Visible, setStep3Visible] = useState(false);
  const [step4Visible, setStep4Visible] = useState(false);
  const [step5Visible, setStep5Visible] = useState(false);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Login functions
  const handleLogin = async (username, password) => {
    setLoading(true);
    setError('');

    try {
      const response = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Request failed' }));
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      const data = await response.json();
      setToken(data.access_token);
      setUser(data.user);
    } catch (error) {
      setError(error.message || 'Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (username, email, password, role = 'user') => {
    setLoading(true);
    setError('');

    try {
      const response = await fetch(`${API_BASE}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, email, password, role })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Request failed' }));
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      setError('Registration successful! Please login.');
    } catch (error) {
      setError(error.message || 'Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    setToken(null);
    setUser(null);
  };

  const showMessage = (text, type) => {
    const newMessage = { text, type, id: Date.now() };
    setMessages(prev => [...prev, newMessage]);
    
    setTimeout(() => {
      setMessages(prev => prev.filter(msg => msg.id !== newMessage.id));
    }, 4000);
  };

  // Configuration functions
  const handleFileSelect = (event) => {
    const file = event.target.files[0];
    
    if (!file) return;
    
    const extension = file.name.split('.').pop().toLowerCase();
    
    if (extension !== 'json' && extension !== 'config') {
      showMessage('Please select a .json or .config file', 'error');
      return;
    }
    
    setCurrentFile(file);
    setStep2Visible(true);
    showMessage('File loaded successfully!', 'success');
  };

  const formatSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getSensitivity = (key) => {
    const keyLower = key.toLowerCase();
    const high = ['password', 'secret', 'key', 'token', 'connectionstring'];
    const medium = ['server', 'host', 'url', 'username', 'email', 'database'];
    
    for (const pattern of high) {
      if (keyLower.includes(pattern)) return 'high';
    }
    for (const pattern of medium) {
      if (keyLower.includes(pattern)) return 'medium';
    }
    return 'low';
  };

  const extractFromJson = (obj, path, configArray) => {
    for (const key in obj) {
      const fullKey = path ? path + '.' + key : key;
      const value = obj[key];
      
      if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        extractFromJson(value, fullKey, configArray);
      } else {
        const sensitivity = getSensitivity(key);
        configArray.push({
          key: fullKey,
          originalKey: key,
          value: String(value),
          sensitivity: sensitivity
        });
      }
    }
  };

  const parseFile = (content) => {
    const newConfigData = [];
    const isJson = currentFile.name.toLowerCase().endsWith('.json');
    
    if (isJson) {
      try {
        const data = JSON.parse(content);
        extractFromJson(data, '', newConfigData);
      } catch (error) {
        throw new Error('Invalid JSON format');
      }
    } else {
      // Parse XML config
      const lines = content.split('\n');
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        
        const addMatch = line.match(/<add\s+key\s*=\s*["']([^"']+)["']\s+value\s*=\s*["']([^"']*)["']/i);
        if (addMatch) {
          const key = addMatch[1];
          const value = addMatch[2];
          const sensitivity = getSensitivity(key);
          
          newConfigData.push({
            key: key,
            originalKey: key,
            value: value,
            sensitivity: sensitivity
          });
        }
      }
    }
    
    setConfigData(newConfigData);
  };

  const processFile = () => {
    const appNameValue = appName.trim();
    
    if (!appNameValue) {
      showMessage('Please enter an application name', 'error');
      return;
    }
    
    if (!currentFile) {
      showMessage('Please select a file first', 'error');
      return;
    }
    
    const reader = new FileReader();
    reader.onload = function(e) {
      setFileContent(e.target.result);
      
      try {
        parseFile(e.target.result);
        setStep3Visible(true);
        showMessage('File processed successfully!', 'success');
      } catch (error) {
        showMessage('Error processing file: ' + error.message, 'error');
      }
    };
    
    reader.onerror = function() {
      showMessage('Error reading file', 'error');
    };
    
    reader.readAsText(currentFile);
  };

  const showEditor = () => {
    setStep4Visible(true);
  };

  const selectEnv = (env) => {
    setSelectedEnvironment(env);
  };

  const updateConfigValue = (index, field, value) => {
    setConfigData(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const saveConfig = () => {
    const appNameValue = appName.trim();
    const versionValue = version.trim();
    
    if (!selectedEnvironment) {
      showMessage('Please select an environment', 'error');
      return;
    }
    
    if (!versionValue) {
      showMessage('Please enter a version', 'error');
      return;
    }
    
    const configId = `${appNameValue}_${selectedEnvironment}_${versionValue}`;
    setSavedConfigs(prev => {
      const newSavedConfigs = { ...prev };
      if (!newSavedConfigs[appNameValue]) {
        newSavedConfigs[appNameValue] = {};
      }
      
      newSavedConfigs[appNameValue][configId] = {
        name: versionValue,
        environment: selectedEnvironment,
        originalContent: fileContent,
        originalFileName: currentFile.name,
        configData: configData,
        savedAt: new Date().toISOString()
      };
      
      return newSavedConfigs;
    });
    
    showMessage('Configuration saved successfully!', 'success');
    setStep5Visible(true);
  };

  const downloadConfig = (appNameKey, configId) => {
    const config = savedConfigs[appNameKey][configId];
    if (!config) return;
    
    let content = '';
    
    if (config.configData) {
      const extension = config.originalFileName.split('.').pop().toLowerCase();
      
      if (extension === 'json') {
        const jsonObj = {};
        config.configData.forEach(item => {
          const keys = item.key.split('.');
          let current = jsonObj;
          for (let i = 0; i < keys.length - 1; i++) {
            if (!(keys[i] in current)) {
              current[keys[i]] = {};
            }
            current = current[keys[i]];
          }
          current[keys[keys.length - 1]] = item.value;
        });
        content = JSON.stringify(jsonObj, null, 2);
      } else {
        content = config.configData.map(item => `<add key="${item.key}" value="${item.value}" />`).join('\n');
      }
    } else {
      content = config.originalContent;
    }
    
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = configId + '.' + config.originalFileName.split('.').pop();
    a.click();
    URL.revokeObjectURL(url);
    
    showMessage('Downloaded successfully!', 'success');
  };

  const deleteConfig = (appNameKey, configId) => {
    if (window.confirm('Delete this configuration?')) {
      setSavedConfigs(prev => {
        const newSavedConfigs = { ...prev };
        delete newSavedConfigs[appNameKey][configId];
        if (Object.keys(newSavedConfigs[appNameKey]).length === 0) {
          delete newSavedConfigs[appNameKey];
        }
        return newSavedConfigs;
      });
      showMessage('Deleted successfully!', 'success');
    }
  };

  const getCounts = () => {
    const counts = { high: 0, medium: 0, low: 0 };
    configData.forEach(item => {
      counts[item.sensitivity]++;
    });
    return counts;
  };

  // Auth Form Component
  const AuthForm = () => {
    const [isLogin, setIsLogin] = useState(true);
    const [formData, setFormData] = useState({
      username: '',
      email: '',
      password: '',
      role: 'user'
    });

    const handleSubmit = () => {
      if (isLogin) {
        handleLogin(formData.username, formData.password);
      } else {
        handleRegister(formData.username, formData.email, formData.password, formData.role);
      }
    };

    return (
      <div style={{ 
        minHeight: '100vh', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        padding: '20px'
      }}>
        <div style={{
          maxWidth: '400px',
          width: '100%',
          background: 'white',
          padding: '40px',
          borderRadius: '20px',
          boxShadow: '0 20px 40px rgba(0,0,0,0.1)'
        }}>
          <div style={{ textAlign: 'center', marginBottom: '30px' }}>
            <h2 style={{ margin: '0 0 10px 0', color: '#333' }}>
              {isLogin ? 'Sign In' : 'Create Account'}
            </h2>
            <p style={{ margin: 0, color: '#666' }}>AI Configuration Manager</p>
          </div>

          <div style={{ marginBottom: '15px' }}>
            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Username</label>
            <input
              type="text"
              style={{ width: '100%', padding: '12px', border: '1px solid #ddd', borderRadius: '8px', fontSize: '14px', boxSizing: 'border-box' }}
              value={formData.username}
              onChange={(e) => setFormData({...formData, username: e.target.value})}
            />
          </div>

          {!isLogin && (
            <div style={{ marginBottom: '15px' }}>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Email</label>
              <input
                type="email"
                style={{ width: '100%', padding: '12px', border: '1px solid #ddd', borderRadius: '8px', fontSize: '14px', boxSizing: 'border-box' }}
                value={formData.email}
                onChange={(e) => setFormData({...formData, email: e.target.value})}
              />
            </div>
          )}

          <div style={{ marginBottom: '15px' }}>
            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Password</label>
            <input
              type="password"
              style={{ width: '100%', padding: '12px', border: '1px solid #ddd', borderRadius: '8px', fontSize: '14px', boxSizing: 'border-box' }}
              value={formData.password}
              onChange={(e) => setFormData({...formData, password: e.target.value})}
            />
          </div>

          {!isLogin && (
            <div style={{ marginBottom: '15px' }}>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Role</label>
              <select
                style={{ width: '100%', padding: '12px', border: '1px solid #ddd', borderRadius: '8px', fontSize: '14px', boxSizing: 'border-box' }}
                value={formData.role}
                onChange={(e) => setFormData({...formData, role: e.target.value})}
              >
                <option value="user">User</option>
                <option value="admin">Admin</option>
              </select>
            </div>
          )}

          {error && (
            <div style={{ background: error.includes('successful') ? '#d4edda' : '#fee', border: `1px solid ${error.includes('successful') ? '#4caf50' : '#f00'}`, color: error.includes('successful') ? '#155724' : '#c00', padding: '10px', borderRadius: '5px', marginBottom: '15px', fontSize: '14px' }}>
              {error}
            </div>
          )}

          <button
            onClick={handleSubmit}
            disabled={loading}
            style={{ width: '100%', padding: '12px', background: loading ? '#bdc3c7' : '#3498db', color: 'white', border: 'none', borderRadius: '8px', fontSize: '16px', cursor: loading ? 'not-allowed' : 'pointer' }}
          >
            {loading ? 'Please wait...' : (isLogin ? 'Sign In' : 'Create Account')}
          </button>

          <div style={{ textAlign: 'center', marginTop: '20px' }}>
            <button
              onClick={() => {
                setIsLogin(!isLogin);
                setError('');
                setFormData({ username: '', email: '', password: '', role: 'user' });
              }}
              style={{ background: 'none', border: 'none', color: '#3498db', cursor: 'pointer', textDecoration: 'underline', fontSize: '14px' }}
            >
              {isLogin ? "Don't have an account? Sign up" : "Already have an account? Sign in"}
            </button>
          </div>
        </div>
      </div>
    );
  };

  // Main UI
  if (!token || !user) {
    return <AuthForm />;
  }

  const counts = getCounts();

  return (
    <div style={{
      fontFamily: 'Arial, sans-serif',
      maxWidth: '1200px',
      margin: '0 auto',
      padding: '20px',
      background: '#f5f5f5'
    }}>
      <div style={{
        background: 'white',
        padding: '30px',
        borderRadius: '10px',
        boxShadow: '0 2px 10px rgba(0,0,0,0.1)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h1>🤖 AI Configuration Manager</h1>
          <button 
            onClick={logout}
            style={{ padding: '8px 16px', background: '#e74c3c', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
          >
            Logout ({user?.username})
          </button>
        </div>
        
        {/* Step 1: Upload */}
        <div style={{
          margin: '20px 0',
          padding: '20px',
          border: '1px solid #ddd',
          borderRadius: '5px'
        }}>
          <h3>1. Upload File</h3>
          <input 
            type="file" 
            accept=".json,.config" 
            onChange={handleFileSelect}
            style={{
              padding: '10px',
              margin: '5px',
              border: '1px solid #ccc',
              borderRadius: '4px'
            }}
          />
          {currentFile && (
            <div>
              <p>File: <span>{currentFile.name}</span> (Size: <span>{formatSize(currentFile.size)}</span>)</p>
            </div>
          )}
        </div>

        {/* Step 2: App Name */}
        {step2Visible && (
          <div style={{
            margin: '20px 0',
            padding: '20px',
            border: '1px solid #ddd',
            borderRadius: '5px'
          }}>
            <h3>2. Application Name</h3>
            <input 
              type="text" 
              placeholder="Enter application name"
              value={appName}
              onChange={(e) => setAppName(e.target.value)}
              style={{
                padding: '10px',
                margin: '5px',
                border: '1px solid #ccc',
                borderRadius: '4px'
              }}
            />
            <button 
              onClick={processFile}
              style={{
                padding: '10px',
                margin: '5px',
                border: '1px solid #ccc',
                borderRadius: '4px',
                background: '#007bff',
                color: 'white',
                cursor: 'pointer'
              }}
            >
              Process File
            </button>
          </div>
        )}

        {/* Step 3: Results */}
        {step3Visible && (
          <div style={{
            margin: '20px 0',
            padding: '20px',
            border: '1px solid #ddd',
            borderRadius: '5px'
          }}>
            <h3>3. Analysis Results</h3>
            <p>High: <span>{counts.high}</span> | Medium: <span>{counts.medium}</span> | Low: <span>{counts.low}</span></p>
            <div style={{
              background: '#2d3748',
              color: 'white',
              padding: '15px',
              borderRadius: '5px',
              fontFamily: 'monospace',
              whiteSpace: 'pre-wrap',
              maxHeight: '300px',
              overflowY: 'auto',
              margin: '10px 0'
            }}>
              {configData.map((item, index) => (
                <div key={index} style={{ marginBottom: '5px' }}>
                  <span style={{
                    color: item.sensitivity === 'high' ? '#dc3545' : 
                          item.sensitivity === 'medium' ? '#ffc107' : '#007bff'
                  }}>
                    [{item.sensitivity.toUpperCase()}]
                  </span> {item.key} = {item.value}
                </div>
              ))}
            </div>
            <button 
              onClick={showEditor}
              style={{
                padding: '10px',
                margin: '5px',
                border: '1px solid #ccc',
                borderRadius: '4px',
                background: '#007bff',
                color: 'white',
                cursor: 'pointer'
              }}
            >
              Edit Configuration
            </button>
          </div>
        )}

        {/* Step 4: Edit */}
        {step4Visible && (
          <div style={{
            margin: '20px 0',
            padding: '20px',
            border: '1px solid #ddd',
            borderRadius: '5px'
          }}>
            <h3>4. Edit Values</h3>
            <div>
              {configData.map((item, index) => (
                <div key={index} style={{
                  border: '1px solid #ddd',
                  padding: '15px',
                  margin: '10px 0',
                  borderRadius: '5px',
                  background: '#f9f9f9',
                  borderLeft: `4px solid ${item.sensitivity === 'high' ? '#dc3545' : 
                                           item.sensitivity === 'medium' ? '#ffc107' : '#007bff'}`
                }}>
                  <strong>{item.key}</strong> 
                  <span style={{
                    background: item.sensitivity === 'high' ? '#dc3545' : 
                               item.sensitivity === 'medium' ? '#ffc107' : '#007bff',
                    color: 'white',
                    padding: '2px 6px',
                    borderRadius: '3px',
                    fontSize: '0.8em',
                    marginLeft: '10px'
                  }}>
                    {item.sensitivity.toUpperCase()}
                  </span>
                  <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                    <input 
                      type="text" 
                      value={item.key}
                      placeholder="Key"
                      onChange={(e) => updateConfigValue(index, 'key', e.target.value)}
                      style={{ flex: 1, padding: '10px', margin: '5px', border: '1px solid #ccc', borderRadius: '4px' }}
                    />
                    <input 
                      type="text"
                      value={item.value}
                      placeholder="Value"
                      onChange={(e) => updateConfigValue(index, 'value', e.target.value)}
                      style={{ flex: 1, padding: '10px', margin: '5px', border: '1px solid #ccc', borderRadius: '4px' }}
                    />
                  </div>
                </div>
              ))}
            </div>
            
            <h4>Environment:</h4>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              gap: '10px',
              margin: '10px 0'
            }}>
              {['DEV', 'QA', 'UAT', 'PROD'].map(env => (
                <div
                  key={env}
                  onClick={() => selectEnv(env)}
                  style={{
                    padding: '10px',
                    background: selectedEnvironment === env ? '#28a745' : '#e9ecef',
                    color: selectedEnvironment === env ? 'white' : 'black',
                    border: '1px solid #ccc',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    textAlign: 'center'
                  }}
                >
                  {env}
                </div>
              ))}
            </div>
            
            <input 
              type="text" 
              placeholder="Version (e.g., v1.0)"
              value={version}
              onChange={(e) => setVersion(e.target.value)}
              style={{
                padding: '10px',
                margin: '5px',
                border: '1px solid #ccc',
                borderRadius: '4px'
              }}
            />
            <button 
              onClick={saveConfig}
              style={{
                padding: '10px',
                margin: '5px',
                border: '1px solid #ccc',
                borderRadius: '4px',
                background: '#007bff',
                color: 'white',
                cursor: 'pointer'
              }}
            >
              Save Configuration
            </button>
          </div>
        )}

        {/* Step 5: Saved */}
        {step5Visible && (
          <div style={{
            margin: '20px 0',
            padding: '20px',
            border: '1px solid #ddd',
            borderRadius: '5px'
          }}>
            <h3>5. Saved Configurations</h3>
            <div>
              {Object.keys(savedConfigs).length === 0 ? (
                <p>No saved configurations.</p>
              ) : (
                Object.keys(savedConfigs).map(appNameKey => (
                  <div key={appNameKey}>
                    <h4>{appNameKey}</h4>
                    {Object.keys(savedConfigs[appNameKey]).map(configId => {
                      const config = savedConfigs[appNameKey][configId];
                      return (
                        <div key={configId} style={{
                          border: '1px solid #ddd',
                          padding: '10px',
                          margin: '5px 0',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center'
                        }}>
                          <div>
                            <strong>{config.name}</strong> - {config.environment}<br/>
                            <small>Saved: {new Date(config.savedAt).toLocaleDateString()}</small>
                          </div>
                          <div>
                            <button 
                              onClick={() => downloadConfig(appNameKey, configId)}
                              style={{
                                padding: '10px',
                                margin: '5px',
                                border: '1px solid #ccc',
                                borderRadius: '4px',
                                background: '#007bff',
                                color: 'white',
                                cursor: 'pointer'
                              }}
                            >
                              Download
                            </button>
                            <button 
                              onClick={() => deleteConfig(appNameKey, configId)}
                              style={{
                                padding: '10px',
                                margin: '5px',
                                border: '1px solid #ccc',
                                borderRadius: '4px',
                                background: '#dc3545',
                                color: 'white',
                                cursor: 'pointer'
                              }}
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* Messages */}
        <div>
          {messages.map(message => (
            <div key={message.id} style={{
              padding: '10px',
              margin: '10px 0',
              borderRadius: '4px',
              background: message.type === 'success' ? '#d4edda' : '#f8d7da',
              color: message.type === 'success' ? '#155724' : '#721c24',
              border: `1px solid ${message.type === 'success' ? '#c3e6cb' : '#f5c6cb'}`
            }}>
              {message.text}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ConfigurationManager;