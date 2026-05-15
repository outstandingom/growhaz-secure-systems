// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title UserRegistry — On-chain user profiles with IPFS CID storage
/// @notice Stores user profile CIDs and basic metadata on-chain.
contract UserRegistry {
    
    struct UserProfile {
        string ipfsCid;
        string name;
        string profession;
        string phoneHash;
        uint256 registeredAt;
        bool exists;
    }
    
    mapping(address => UserProfile) public users;
    uint256 public userCount;
    
    event UserRegistered(address indexed wallet, string ipfsCid);
    event ProfileUpdated(address indexed wallet, string ipfsCid);
    
    function registerUser(
        string memory _ipfsCid,
        string memory _name,
        string memory _profession,
        string memory _phoneHash
    ) public {
        require(!users[msg.sender].exists, "User already registered");
        
        users[msg.sender] = UserProfile({
            ipfsCid: _ipfsCid,
            name: _name,
            profession: _profession,
            phoneHash: _phoneHash,
            registeredAt: block.timestamp,
            exists: true
        });
        
        userCount++;
        emit UserRegistered(msg.sender, _ipfsCid);
    }
    
    function updateProfile(
        string memory _ipfsCid,
        string memory _name,
        string memory _profession,
        string memory _phoneHash
    ) public {
        require(users[msg.sender].exists, "User not registered");
        
        users[msg.sender].ipfsCid = _ipfsCid;
        users[msg.sender].name = _name;
        users[msg.sender].profession = _profession;
        users[msg.sender].phoneHash = _phoneHash;
        
        emit ProfileUpdated(msg.sender, _ipfsCid);
    }
    
    function getUser(address _wallet) public view returns (
        string memory, string memory, string memory, string memory,
        uint256, bool
    ) {
        UserProfile memory u = users[_wallet];
        return (u.ipfsCid, u.name, u.profession, u.phoneHash, u.registeredAt, u.exists);
    }
    
    function getRegisteredUsersCount() public view returns (uint256) {
        return userCount;
    }
}
