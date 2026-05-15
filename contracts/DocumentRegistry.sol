// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title DocumentRegistry
 * @dev Stores document hashes on the blockchain for immutable verification.
 * In Ethereum/Polygon, the network itself manages the blocks and the "Genesis Block".
 * This contract acts as your ledger on top of that blockchain.
 */
contract DocumentRegistry {
    
    // Struct to hold document verification data
    struct Document {
        string documentId;
        string documentHash;
        string ownerId;
        uint256 timestamp;
        address verifier;
    }

    // Mapping to look up a document quickly by its hash
    mapping(string => Document) public documents;
    
    // Array to keep track of all verified document hashes
    string[] public verifiedDocumentHashes;

    // Event emitted when a new document is verified on-chain
    event DocumentVerified(
        string documentId, 
        string documentHash, 
        string ownerId, 
        uint256 timestamp,
        address verifier
    );

    // Modifier to prevent re-verifying the exact same document
    modifier documentNotExists(string memory _documentHash) {
        require(documents[_documentHash].timestamp == 0, "Document already exists on the blockchain");
        _;
    }

    /**
     * @dev Adds a new document hash to the blockchain ledger.
     */
    function verifyDocument(
        string memory _documentId, 
        string memory _documentHash, 
        string memory _ownerId
    ) public documentNotExists(_documentHash) {
        
        // Store the document in the contract state
        documents[_documentHash] = Document({
            documentId: _documentId,
            documentHash: _documentHash,
            ownerId: _ownerId,
            timestamp: block.timestamp, // Uses the actual blockchain block timestamp
            verifier: msg.sender        // The wallet address that performed the transaction
        });

        verifiedDocumentHashes.push(_documentHash);

        // Emit an event so frontend applications can listen for it
        emit DocumentVerified(_documentId, _documentHash, _ownerId, block.timestamp, msg.sender);
    }

    /**
     * @dev Checks if a document hash is already verified on the blockchain.
     */
    function isDocumentVerified(string memory _documentHash) public view returns (bool) {
        return documents[_documentHash].timestamp != 0;
    }

    /**
     * @dev Retrieves the full details of a verified document.
     */
    function getDocumentDetails(string memory _documentHash) public view returns (
        string memory documentId,
        string memory ownerId,
        uint256 timestamp,
        address verifier
    ) {
        require(documents[_documentHash].timestamp != 0, "Document not found");
        
        Document memory doc = documents[_documentHash];
        return (doc.documentId, doc.ownerId, doc.timestamp, doc.verifier);
    }
    
    /**
     * @dev Returns the total number of documents secured by this contract.
     */
    function getTotalDocuments() public view returns (uint256) {
        return verifiedDocumentHashes.length;
    }
}
