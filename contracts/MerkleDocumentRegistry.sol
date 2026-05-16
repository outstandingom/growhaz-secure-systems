// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * MerkleDocumentRegistry
 *
 * Stores Merkle roots derived from document content.
 * Flow: Content → Tokens → Chunks → SHA-256 per chunk → Merkle Tree → Root Hash
 *
 * The Merkle root is a fingerprint of the MEANING of the document,
 * not the raw bytes. Two differently formatted copies of the same
 * document will produce the same Merkle root.
 *
 * Deploy this on Sepolia via Remix IDE, then paste the address into contractConfig.ts.
 */
contract MerkleDocumentRegistry {

    struct Document {
        string   merkleRoot;       // Merkle tree root hash
        string   fileHash;         // SHA-256 of raw file bytes
        string   contentHash;      // SHA-256 of cleaned extracted text
        string   ipfsCid;          // IPFS CID of the original file
        string   metadataCid;      // IPFS CID of metadata JSON
        uint256  totalChunks;      // Number of chunks used to build the tree
        uint256  totalTokens;      // Number of tokens in the document
        address  issuer;           // Wallet that registered the document
        uint256  timestamp;        // Block timestamp at registration
        string   docType;          // e.g. "certificate", "invoice", "identity"
        string   documentName;     // Original file name
        bool     exists;           // Guard against empty reads
    }

    // merkleRoot => Document
    mapping(string => Document) public documentsByMerkle;

    // fileHash => merkleRoot (reverse lookup)
    mapping(string => string) public merkleByFileHash;

    // contentHash => merkleRoot (reverse lookup)
    mapping(string => string) public merkleByContentHash;

    // issuer => list of merkle roots
    mapping(address => string[]) public issuerDocuments;

    // All registered merkle roots (for enumeration)
    string[] public allMerkleRoots;

    // ─── Events ──────────────────────────────────────────────────────────

    event DocumentRegistered(
        string   merkleRoot,
        string   fileHash,
        string   contentHash,
        string   ipfsCid,
        uint256  totalChunks,
        uint256  totalTokens,
        address  indexed issuer,
        string   docType,
        string   documentName
    );

    event DocumentVerified(
        string  merkleRoot,
        bool    isAuthentic,
        address indexed verifier
    );

    // ─── Write ───────────────────────────────────────────────────────────

    function registerDocument(
        string memory _merkleRoot,
        string memory _fileHash,
        string memory _contentHash,
        string memory _ipfsCid,
        string memory _metadataCid,
        uint256       _totalChunks,
        uint256       _totalTokens,
        string memory _docType,
        string memory _documentName
    ) external {
        require(!documentsByMerkle[_merkleRoot].exists, "Merkle root already registered");

        documentsByMerkle[_merkleRoot] = Document({
            merkleRoot:   _merkleRoot,
            fileHash:     _fileHash,
            contentHash:  _contentHash,
            ipfsCid:      _ipfsCid,
            metadataCid:  _metadataCid,
            totalChunks:  _totalChunks,
            totalTokens:  _totalTokens,
            issuer:       msg.sender,
            timestamp:    block.timestamp,
            docType:      _docType,
            documentName: _documentName,
            exists:       true
        });

        merkleByFileHash[_fileHash]       = _merkleRoot;
        merkleByContentHash[_contentHash] = _merkleRoot;

        issuerDocuments[msg.sender].push(_merkleRoot);
        allMerkleRoots.push(_merkleRoot);

        emit DocumentRegistered(
            _merkleRoot, _fileHash, _contentHash, _ipfsCid,
            _totalChunks, _totalTokens, msg.sender, _docType, _documentName
        );
    }

    // ─── Read ────────────────────────────────────────────────────────────

    function getDocumentByMerkle(string memory _merkleRoot)
        external view returns (
            string memory fileHash,
            string memory contentHash,
            string memory ipfsCid,
            string memory metadataCid,
            uint256       totalChunks,
            uint256       totalTokens,
            address       issuer,
            uint256       timestamp,
            string memory docType,
            string memory documentName,
            bool          exists
        )
    {
        Document storage doc = documentsByMerkle[_merkleRoot];
        return (
            doc.fileHash, doc.contentHash, doc.ipfsCid, doc.metadataCid,
            doc.totalChunks, doc.totalTokens, doc.issuer, doc.timestamp,
            doc.docType, doc.documentName, doc.exists
        );
    }

    function verifyMerkleRoot(string memory _merkleRoot)
        external returns (bool)
    {
        bool isAuthentic = documentsByMerkle[_merkleRoot].exists;
        emit DocumentVerified(_merkleRoot, isAuthentic, msg.sender);
        return isAuthentic;
    }

    function lookupByFileHash(string memory _fileHash)
        external view returns (string memory merkleRoot)
    {
        return merkleByFileHash[_fileHash];
    }

    function lookupByContentHash(string memory _contentHash)
        external view returns (string memory merkleRoot)
    {
        return merkleByContentHash[_contentHash];
    }

    function getIssuerDocuments(address _issuer)
        external view returns (string[] memory)
    {
        return issuerDocuments[_issuer];
    }

    function getTotalDocuments() external view returns (uint256) {
        return allMerkleRoots.length;
    }
}
