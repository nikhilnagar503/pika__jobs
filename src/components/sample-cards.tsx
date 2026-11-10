const samples = [
  ["Frontend engineering intern", "Example Studio", "ES", "Bengaluru · Hybrid", "INR 20,000 to 25,000 per month", "Internship · Students and freshers"],
  ["Operations associate", "Northwind Polytechnic", "NP", "Pune · On site", "Pay not disclosed", "Job · 1 to 2 years"],
  ["Junior engineer", "Example Public Works", "EP", "India · Government", "Pay on the official notice", "Government · Check the notice"],
];

export function SampleCards() {
  return (
    <div className="grid-3">
      {samples.map(([title, company, initials, where, pay, kind]) => (
        <article className="card sample" key={title}>
          <span className="flag">Sample listing</span>
          <div className="company" style={{ marginTop: 12 }}>
            <div className="avatar" aria-hidden="true">{initials}</div>
            <div>
              <div className="meta">{company}</div>
              <h3>{title}</h3>
            </div>
          </div>
          <p className="meta">{where}</p>
          <p>{pay}</p>
          <p className="meta">{kind}</p>
        </article>
      ))}
    </div>
  );
}
