// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title DocumentAccessControl — On-chain permission management
/// @notice Grant/revoke document viewing access. Optimized for minimal gas.
contract DocumentAccessControl {
    
    struct AccessGrant {
        address owner;
        uint256 grantedAt;
        uint256 expiresAt;
        bool active;
    }
    
    // keccak256(docId, viewer, owner) => AccessGrant
    mapping(bytes32 => AccessGrant) public accessGrants;
    mapping(string => address[]) public documentViewers;
    
    event AccessGranted(string docId, address indexed viewer, uint256 expiresAt);
    event AccessRevoked(string docId, address indexed viewer);
    
    function grantAccess(
        string calldata _docId,
        address _viewer,
        uint256 _expiresAt
    ) external {
        bytes32 grantId = keccak256(abi.encodePacked(_docId, _viewer, msg.sender));
        require(!accessGrants[grantId].active, "Already granted");
        accessGrants[grantId] = AccessGrant(msg.sender, block.timestamp, _expiresAt, true);
        documentViewers[_docId].push(_viewer);
        emit AccessGranted(_docId, _viewer, _expiresAt);
    }
    
    function revokeAccess(string calldata _docId, address _viewer) external {
        bytes32 grantId = keccak256(abi.encodePacked(_docId, _viewer, msg.sender));
        require(accessGrants[grantId].active, "Not granted");
        accessGrants[grantId].active = false;
        emit AccessRevoked(_docId, _viewer);
    }
    
    function hasAccess(string calldata _docId, address _viewer, address _owner) 
        external view returns (bool) 
    {
        bytes32 grantId = keccak256(abi.encodePacked(_docId, _viewer, _owner));
        AccessGrant memory g = accessGrants[grantId];
        if (!g.active) return false;
        if (g.expiresAt > 0 && block.timestamp > g.expiresAt) return false;
        return true;
    }
    
    function getDocumentViewers(string calldata _docId) external view returns (address[] memory) {
        return documentViewers[_docId];
    }
}
