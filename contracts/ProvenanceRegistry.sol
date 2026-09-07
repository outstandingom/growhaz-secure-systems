// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * ProvenanceRegistry
 * -------------------------------------------------------------------------
 * Versioned, tamper-evident provenance for off-chain documents.
 * Only cryptographic commitments and provenance metadata go on-chain — never
 * the document itself and never personal data.
 *
 * Target network: Arbitrum Sepolia (dev) / Arbitrum One (production).
 *
 * Design rules:
 *  - Versions are append-only. Nothing is ever overwritten or deleted.
 *  - Every version references its previous version (V2.previous = V1).
 *  - Revocation and supersession change state, they do not remove history.
 */
contract ProvenanceRegistry {
    // ── Types ────────────────────────────────────────────────────────────
    enum EventType { REGISTERED, UPDATED, APPROVED, VERIFIED }
    enum State { ACTIVE, REVOKED, SUPERSEDED }

    struct Version {
        uint256 version;
        uint256 previousVersion; // 0 for the first version
        string fileHash;
        string contentHash;
        string merkleRoot;
        string semanticHash; // knowledge-graph commitment
        string metadataURI; // IPFS/Arweave URI, never the raw document
        address actor;
        EventType eventType;
        State state;
        uint256 supersededBy; // version number, 0 when not superseded
        uint256 timestamp;
        bool exists;
    }

    struct Record {
        address issuer;
        uint256 currentVersion;
        uint256 createdAt;
        bool exists;
    }

    struct Attestation {
        address actor;
        string role; // ISSUER / REGISTRAR / AUDITOR ...
        string statementHash; // hash of the attestation statement
        uint256 timestamp;
    }

    // ── Storage ──────────────────────────────────────────────────────────
    mapping(string => Record) private records;
    mapping(string => mapping(uint256 => Version)) private versions;
    mapping(string => mapping(uint256 => Attestation[])) private attestations;
    mapping(address => string[]) private issuerRecords;

    uint256 public totalRecords;

    // ── Events ───────────────────────────────────────────────────────────
    event RecordRegistered(string indexed recordKey, string recordId, address indexed issuer, uint256 timestamp);
    event VersionAdded(
        string indexed recordKey,
        string recordId,
        uint256 indexed version,
        uint256 previousVersion,
        address indexed actor,
        EventType eventType,
        string fileHash,
        string contentHash,
        string merkleRoot,
        string semanticHash
    );
    event VersionAttested(string indexed recordKey, uint256 indexed version, address indexed actor, string role, string statementHash);
    event VersionRevoked(string indexed recordKey, uint256 indexed version, address indexed actor, string reasonHash);
    event VersionSuperseded(string indexed recordKey, uint256 indexed oldVersion, uint256 newVersion, address indexed actor);

    // ── Modifiers ────────────────────────────────────────────────────────
    modifier recordExists(string calldata _recordId) {
        require(records[_recordId].exists, "Record not found");
        _;
    }

    modifier onlyIssuer(string calldata _recordId) {
        require(records[_recordId].issuer == msg.sender, "Not the record issuer");
        _;
    }

    // ── Write ────────────────────────────────────────────────────────────

    /// Registers a new record and writes version 1 in a single transaction.
    function registerRecord(
        string calldata _recordId,
        string calldata _fileHash,
        string calldata _contentHash,
        string calldata _merkleRoot,
        string calldata _semanticHash,
        string calldata _metadataURI
    ) external {
        require(bytes(_recordId).length > 0, "recordId required");
        require(!records[_recordId].exists, "Record already registered");

        records[_recordId] = Record({
            issuer: msg.sender,
            currentVersion: 1,
            createdAt: block.timestamp,
            exists: true
        });

        versions[_recordId][1] = Version({
            version: 1,
            previousVersion: 0,
            fileHash: _fileHash,
            contentHash: _contentHash,
            merkleRoot: _merkleRoot,
            semanticHash: _semanticHash,
            metadataURI: _metadataURI,
            actor: msg.sender,
            eventType: EventType.REGISTERED,
            state: State.ACTIVE,
            supersededBy: 0,
            timestamp: block.timestamp,
            exists: true
        });

        issuerRecords[msg.sender].push(_recordId);
        totalRecords += 1;

        emit RecordRegistered(_recordId, _recordId, msg.sender, block.timestamp);
        emit VersionAdded(
            _recordId,
            _recordId,
            1,
            0,
            msg.sender,
            EventType.REGISTERED,
            _fileHash,
            _contentHash,
            _merkleRoot,
            _semanticHash
        );
    }

    /// Appends a new version. The previous version is automatically superseded.
    function addVersion(
        string calldata _recordId,
        string calldata _fileHash,
        string calldata _contentHash,
        string calldata _merkleRoot,
        string calldata _semanticHash,
        string calldata _metadataURI,
        EventType _eventType
    ) external recordExists(_recordId) onlyIssuer(_recordId) returns (uint256) {
        uint256 previous = records[_recordId].currentVersion;
        uint256 next = previous + 1;

        versions[_recordId][next] = Version({
            version: next,
            previousVersion: previous,
            fileHash: _fileHash,
            contentHash: _contentHash,
            merkleRoot: _merkleRoot,
            semanticHash: _semanticHash,
            metadataURI: _metadataURI,
            actor: msg.sender,
            eventType: _eventType,
            state: State.ACTIVE,
            supersededBy: 0,
            timestamp: block.timestamp,
            exists: true
        });

        if (versions[_recordId][previous].state == State.ACTIVE) {
            versions[_recordId][previous].state = State.SUPERSEDED;
            versions[_recordId][previous].supersededBy = next;
            emit VersionSuperseded(_recordId, previous, next, msg.sender);
        }

        records[_recordId].currentVersion = next;

        emit VersionAdded(
            _recordId,
            _recordId,
            next,
            previous,
            msg.sender,
            _eventType,
            _fileHash,
            _contentHash,
            _merkleRoot,
            _semanticHash
        );
        return next;
    }

    /// Any actor may attest a version (issuer approval, registrar, auditor...).
    function attestVersion(
        string calldata _recordId,
        uint256 _version,
        string calldata _role,
        string calldata _statementHash
    ) external recordExists(_recordId) {
        require(versions[_recordId][_version].exists, "Version not found");

        attestations[_recordId][_version].push(
            Attestation({
                actor: msg.sender,
                role: _role,
                statementHash: _statementHash,
                timestamp: block.timestamp
            })
        );

        emit VersionAttested(_recordId, _version, msg.sender, _role, _statementHash);
    }

    /// Marks a version revoked. History is preserved.
    function revokeVersion(
        string calldata _recordId,
        uint256 _version,
        string calldata _reasonHash
    ) external recordExists(_recordId) onlyIssuer(_recordId) {
        Version storage v = versions[_recordId][_version];
        require(v.exists, "Version not found");
        require(v.state != State.REVOKED, "Already revoked");

        v.state = State.REVOKED;
        emit VersionRevoked(_recordId, _version, msg.sender, _reasonHash);
    }

    /// Explicitly marks an old version as superseded by a newer existing one.
    function supersedeVersion(
        string calldata _recordId,
        uint256 _oldVersion,
        uint256 _newVersion
    ) external recordExists(_recordId) onlyIssuer(_recordId) {
        Version storage oldV = versions[_recordId][_oldVersion];
        require(oldV.exists, "Old version not found");
        require(versions[_recordId][_newVersion].exists, "New version not found");
        require(_newVersion > _oldVersion, "New version must be later");
        require(oldV.state == State.ACTIVE, "Old version is not active");

        oldV.state = State.SUPERSEDED;
        oldV.supersededBy = _newVersion;
        emit VersionSuperseded(_recordId, _oldVersion, _newVersion, msg.sender);
    }

    // ── Read ─────────────────────────────────────────────────────────────

    function getRecord(string calldata _recordId)
        external
        view
        returns (address issuer, uint256 currentVersion, uint256 createdAt, bool exists)
    {
        Record storage r = records[_recordId];
        return (r.issuer, r.currentVersion, r.createdAt, r.exists);
    }

    function getVersion(string calldata _recordId, uint256 _version)
        external
        view
        returns (Version memory)
    {
        return versions[_recordId][_version];
    }

    function getVersionHistory(string calldata _recordId) external view returns (Version[] memory) {
        uint256 count = records[_recordId].currentVersion;
        Version[] memory history = new Version[](count);
        for (uint256 i = 1; i <= count; i++) {
            history[i - 1] = versions[_recordId][i];
        }
        return history;
    }

    function getAttestations(string calldata _recordId, uint256 _version)
        external
        view
        returns (Attestation[] memory)
    {
        return attestations[_recordId][_version];
    }

    function getIssuerRecords(address _issuer) external view returns (string[] memory) {
        return issuerRecords[_issuer];
    }

    /// Convenience check used by public verification pages.
    function verifyHashes(
        string calldata _recordId,
        uint256 _version,
        string calldata _fileHash,
        string calldata _contentHash
    ) external view returns (bool fileMatch, bool contentMatch, State state) {
        Version storage v = versions[_recordId][_version];
        require(v.exists, "Version not found");
        fileMatch = keccak256(bytes(v.fileHash)) == keccak256(bytes(_fileHash));
        contentMatch = keccak256(bytes(v.contentHash)) == keccak256(bytes(_contentHash));
        state = v.state;
    }
}
