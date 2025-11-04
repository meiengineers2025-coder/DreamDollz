async function matchResumes() {
    const jobText = document.getElementById("jobText").value;

    const response = await fetch("/match-resumes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ job_description: jobText })
    });

    const results = await response.json();
    let html = "<h3>Matching Candidates</h3><br>";

    results.forEach(r => {
        html += `
            <p><b>${r.full_name}</b> - Score: ${r.score}<br>
            <a href="${r.resume_path}" target="_blank">View Resume</a><br><br>
        `;
    });

    document.getElementById("results").innerHTML = html;
}