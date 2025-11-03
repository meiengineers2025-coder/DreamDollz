// script.js — Frontend logic for Jobs Portal

const jobList = document.getElementById('job-list');
const jobForm = document.getElementById('job-form');
const titleInput = document.getElementById('title');
const companyInput = document.getElementById('company');
const locationInput = document.getElementById('location');
const descriptionInput = document.getElementById('description');
const apiBase = '/api/jobs'; // Backend API route

// Fetch and display all jobs
async function loadJobs() {
  try {
    const res = await fetch(apiBase);
    const jobs = await res.json();
    jobList.innerHTML = '';

    if (jobs.length === 0) {
      jobList.innerHTML = '<p>No jobs posted yet.</p>';
      return;
    }

    jobs.forEach(job => {
      const card = document.createElement('div');
      card.className = 'job-card';
      card.innerHTML = `
        <h3>${job.title}</h3>
        <p><strong>Company:</strong> ${job.company}</p>
        <p><strong>Location:</strong> ${job.location || 'N/A'}</p>
        <p>${job.description || ''}</p>
      `;
      jobList.appendChild(card);
    });
  } catch (err) {
    console.error('Failed to load jobs:', err);
    jobList.innerHTML = '<p class="error">Failed to load jobs. Please try again later.</p>';
  }
}

// Handle new job submission
jobForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const newJob = {
    title: titleInput.value.trim(),
    company: companyInput.value.trim(),
    location: locationInput.value.trim(),
    description: descriptionInput.value.trim()
  };

  if (!newJob.title || !newJob.company) {
    alert('Please fill in both Title and Company.');
    return;
  }

  try {
    const res = await fetch(apiBase, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newJob)
    });

    if (res.ok) {
      titleInput.value = '';
      companyInput.value = '';
      locationInput.value = '';
      descriptionInput.value = '';
      loadJobs();
    } else {
      alert('Error adding job.');
    }
  } catch (err) {
    console.error('Failed to add job:', err);
  }
});

// Initialize
document.addEventListener('DOMContentLoaded', loadJobs);