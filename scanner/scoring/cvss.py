from scanner.models.finding import CVSSInfo

def calculate_cvss(vuln_type: str, **overrides) -> CVSSInfo:
    """
    Calculate CVSS v3.1 score for a given vulnerability type.
    Includes fixed scope comparison and per-finding metric adjustment.
    """
    base_metrics = {
        "AV": "N", "AC": "L", "PR": "N", "UI": "N", "S": "U", "C": "L", "I": "L", "A": "N"
    }

    # Vuln specific defaults
    if "sql" in vuln_type.lower():
        base_metrics.update({"C": "H", "I": "H", "A": "H"})
    elif "xss" in vuln_type.lower():
        base_metrics.update({"UI": "R", "S": "C", "C": "L", "I": "L"})
    
    # Apply overrides (string values, not floats, for correct scope comparison)
    for k, v in overrides.items():
        base_metrics[k] = str(v)
    
    vector = f"CVSS:3.1/AV:{base_metrics['AV']}/AC:{base_metrics['AC']}/PR:{base_metrics['PR']}/UI:{base_metrics['UI']}/S:{base_metrics['S']}/C:{base_metrics['C']}/I:{base_metrics['I']}/A:{base_metrics['A']}"
    
    # Heuristic score calculation
    base_score = 5.0
    if base_metrics["C"] == "H" and base_metrics["I"] == "H":
        base_score = 9.8 if base_metrics["S"] == "U" else 10.0
    elif base_metrics["S"] == "C":
        base_score = 6.1
        
    severity = "MEDIUM"
    if base_score >= 9.0: severity = "CRITICAL"
    elif base_score >= 7.0: severity = "HIGH"
    elif base_score < 4.0: severity = "LOW"
    
    return CVSSInfo(
        version="3.1",
        vector=vector,
        base_score=base_score,
        severity=severity,
        estimated=True
    )
