// script.js
const api = '/api';

// Tabs
const tabJobs = document.getElementById('tab-jobs');
const tabCandidate = document.getElementById('tab-candidate');
const tabEmployer = document.getElementById('tab-employer');
const jobsSection = document.getElementById('jobs-section');
const candidateSection = document.getElementById('candidate-section');
const employerSection = document.getElementById('employer-section');
const employerDashboard = document.getElementById('employer-dashboard');

function showTab(tab) {
  [tabJobs, tabCandidate, tabEmployer].forEach(t => t.classList.remove('active'));
  [jobsSection, candidateSection, employerSection].forEach(s => s.classList.add('hidden'));
  tab.classList.add('active');
  if (tab === tabJobs) jobsSection.classList.remove('hidden');
  if (tab === tabCandidate) candidateSection.classList.remove('hidden');
  if (tab === tabEmployer) employerSection.classList.remove('hidden');
}
tabJobs.onclick = () => showTab(tabJobs);
tabCandidate.onclick = () => showTab(tabCandidate);
tabEmployer.onclick = () => showTab(tabEmployer);

// Auth tokens
let candidateToken = null;
let employerToken = null;

// JOBS
const jobList = document.getElementById('job-list');
async function loadJobs() {
  const res = await fetch(api + '/jobs');
  const jobs = await res.json();
  jobList.innerHTML = '';
  if (!jobs || jobs.length === 0) jobList.innerHTML = '<p>No jobs yet.</p>';
  jobs.forEach(job => {
    const div = document.createElement('div');
    div.className = 'job-card';
    div.innerHTML = `
      <h3>${job.title}</h3>
      <p><strong>Company:</strong> ${job.company}</p>
      <p><strong>Location:</strong> ${job.location || 'N/A'}</p>
      <p>${job.description || ''}</p>
      ${candidateToken ? `<button class="apply-btn" data-id="${job.id}">Apply</button>` : ''}
    `;
    jobList.appendChild(div);
  });

  // attach apply handlers
  document.querySelectorAll('.apply-btn').forEach(btn => {
    btn.onclick = async () => {
      const jobId = btn.dataset.id;
      const message = prompt('Message to employer (optional):');
      const res = await fetch(`${api}/jobs/${jobId}/apply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${candidateToken}` },
        body: JSON.stringify({ message })
      });
      const data = await res.json();
      if (data.id) alert('Applied successfully');
      else alert(data.error || 'Failed to apply');
    };
  });
}

// Candidate register (with resume)
document.getElementById('candidate-register-form').onsubmit = async (e) => {
  e.preventDefault();
  const name = document.getElementById('c-name').value;
  const email = document.getElementById('c-email').value;
  const password = document.getElementById('c-password').value;
  const resumeInput = document.getElementById('c-resume');
  const fd = new FormData();
  fd.append('name', name);
  fd.append('email', email);
  fd.append('password', password);
  if (resumeInput.files && resumeInput.files[0]) fd.append('resume', resumeInput.files[0]);

  const res = await fetch(`${api}/register`, {
    method: 'POST',
    body: fd
  });
  const data = await res.json();
  if (data.token) {
    candidateToken = data.token;
    alert('Registered & logged in');
    showTab(tabJobs);
    loadJobs();
  } else {
    alert(data.error || 'Registration failed');
  }
};

// Candidate login
document.getElementById('c-login-btn').onclick = async () => {
  const email = document.getElementById('c-login-email').value;
  const password = document.getElementById('c-login-password').value;
  const res = await fetch(`${api}/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });
  const data = await res.json();
  if (data.token) {
    candidateToken = data.token;
    alert('Logged in');
    showTab(tabJobs);
    loadJobs();
  } else alert(data.error || 'Login failed');
};

// Employer register/login
document.getElementById('e-register-btn').onclick = async () => {
  const name = document.getElementById('e-name').value;
  const email = document.getElementById('e-email').value;
  const password = document.getElementById('e-password').value;
  const res = await fetch(`${api}/employer/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, email, password })
  });
  const data = await res.json();
  if (data.token) {
    employerToken = data.token;
    alert('Employer registered & logged in');
    showEmployerDashboard();
  } else alert(data.error || 'Register failed');
};

document.getElementById('e-login-btn').onclick = async () => {
  const email = document.getElementById('e-login-email').value;
  const password = document.getElementById('e-login-password').value;
  const res = await fetch(`${api}/employer/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });
  const data = await res.json();
  if (data.token) {
    employerToken = data.token;
    alert('Employer logged in');
    showEmployerDashboard();
  } else alert(data.error || 'Login failed');
};

// Employer dashboard functions
async function showEmployerDashboard() {
  employerDashboard.classList.remove('hidden');

  // load applicants
  const appRes = await fetch(`${api}/employer/applicants`, { headers: { Authorization: `Bearer ${employerToken}` } });
  const applicants = await appRes.json();
  const aList = document.getElementById('applicants-list');
  aList.innerHTML = '';
  if (applicants && applicants.length) {
    applicants.forEach(a => {
      const d = document.createElement('div');
      d.className = 'job-card';
      d.innerHTML = `
        <h4>${a.job_title}</h4>
        <p>Candidate: ${a.candidate_name} (${a.candidate_email})</p>
        <p>Message: ${a.message || ''}</p>
        <p>Resume: ${a.resume ? `<a href="${a.resume}" target="_blank">Download</a>` : 'No resume'}</p>
        <p>Applied: ${a.applied_at}</p>
      `;
      aList.appendChild(d);
    });
  } else aList.innerHTML = '<p>No applicants yet.</p>';

  // load payments
  const payRes = await fetch(`${api}/employer/payments`, { headers: { Authorization: `Bearer ${employerToken}` } });
  const pays = await payRes.json();
  const pList = document.getElementById('employer-payments-list');
  pList.innerHTML = '';
  if (pays && pays.length) {
    pays.forEach(p => {
      const e = document.createElement('div');
      e.className = 'job-card';
      e.innerHTML = `<p>Amount: ${p.amount} — Capture ID: ${p.paypal_capture_id} — On: ${p.created_at}</p>`;
      pList.appendChild(e);
    });
  } else pList.innerHTML = '<p>No payments yet.</p>';
}

// Create Job
document.getElementById('create-job-btn').onclick = async () => {
  const title = document.getElementById('job-title').value;
  const company = document.getElementById('job-company').value;
  const location = document.getElementById('job-location').value;
  const description = document.getElementById('job-desc').value;
  const res = await fetch(`${api}/jobs`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${employerToken}` },
    body: JSON.stringify({ title, company, location, description })
  });
  const data = await res.json();
  if (data.id) {
    alert('Job created');
    loadJobs();
    document.getElementById('job-title').value = '';
    document.getElementById('job-company').value = '';
    document.getElementById('job-location').value = '';
    document.getElementById('job-desc').value = '';
  } else alert(data.error || 'Failed to create job');
};

// PayPal: create order then redirect to approve URL (employer)
document.getElementById('create-order-btn').onclick = async () => {
  const amount = document.getElementById('pay-amount').value;
  if (!amount) return alert('Enter amount');
  const res = await fetch(`${api}/paypal/create-order`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${employerToken}` },
    body: JSON.stringify({ amount })
  });
  const data = await res.json();
  if (data.approveUrl) {
    // open the PayPal approval page in new tab
    window.open(data.approveUrl, '_blank');
    document.getElementById('payment-result').innerText = 'Approval opened. After approving payment, click "Capture Payment" below to finalize (use same browser).';
    // show capture button UI
    const captureBtn = document.createElement('button');
    captureBtn.innerText = 'Capture Payment (Enter Order ID)';
    captureBtn.onclick = async () => {
      const orderId = prompt('Enter PayPal Order ID (orderID) from approval URL or returned status (e.g. O-XXXX):');
      if (!orderId) return;
      const capRes = await fetch(`${api}/paypal/capture-order`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${employerToken}` },
        body: JSON.stringify({ orderID: orderId })
      });
      const capData = await capRes.json();
      if (capData.captured) {
        alert('Payment captured: ' + capData.paypalCaptureId);
        showEmployerDashboard();
      } else {
        alert(capData.error || 'Capture failed');
      }
    };
    document.getElementById('payment-result').appendChild(captureBtn);
  } else {
    alert(data.error || 'Failed to create order');
  }
};

// init
showTab(tabJobs);
loadJobs();