import axios from 'axios';

async function testLogin() {
  try {
    console.log('Testing Login API...');
    const response = await axios.post('http://localhost:2001/api/auth/login', {
      username: 'admin',
      password: 'admin'
    });
    console.log('✅ Login Successful:', response.data);
  } catch (error) {
    console.error('❌ Login Failed:', error.response ? error.response.data : error.message);
  }
}

testLogin();

