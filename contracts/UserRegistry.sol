// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title UserRegistry — On-chain user profiles with IPFS CID storage
/// @notice Stores user profile IPFS CID, name, profession, phoneHash, age, emailHash
contract UserRegistry {
    
    struct UserProfile {
        string ipfsCid;
        string name;
        string profession;
        string phoneHash;
        uint256 age;           // >= 18
        string emailHash;      // SHA-256 hash of email
        uint256 registeredAt;
        bool exists;
    }
    
    mapping(address => UserProfile) public users;
    uint256 public userCount;
    
    event UserRegistered(address indexed wallet, string ipfsCid, string name, uint256 age);
    event ProfileUpdated(address indexed wallet, string ipfsCid);
    
    function registerUser(
        string memory _ipfsCid,
        string memory _name,
        string memory _profession,
        string memory _phoneHash,
        uint256 _age,
        string memory _emailHash
    ) public {
        require(!users[msg.sender].exists, "User already registered");
        require(_age >= 18, "Age must be 18+");
        
        users[msg.sender] = UserProfile({
            ipfsCid: _ipfsCid,
            name: _name,
            profession: _profession,
            phoneHash: _phoneHash,
            age: _age,
            emailHash: _emailHash,
            registeredAt: block.timestamp,
            exists: true
        });
        
        userCount++;
        emit UserRegistered(msg.sender, _ipfsCid, _name, _age);
    }
    
    function updateProfile(
        string memory _ipfsCid,
        string memory _name,
        string memory _profession,
        string memory _phoneHash,
        uint256 _age,
        string memory _emailHash
    ) public {
        require(users[msg.sender].exists, "User not registered");
        
        UserProfile storage u = users[msg.sender];
        u.ipfsCid = _ipfsCid;
        u.name = _name;
        u.profession = _profession;
        u.phoneHash = _phoneHash;
        u.age = _age;
        u.emailHash = _emailHash;
        
        emit ProfileUpdated(msg.sender, _ipfsCid);
    }
    
    function getUser(address _wallet) public view returns (
        string memory ipfsCid,
        string memory name,
        string memory profession,
        string memory phoneHash,
        uint256 age,
        string memory emailHash,
        uint256 registeredAt,
        bool exists
    ) {
        UserProfile memory u = users[_wallet];
        return (u.ipfsCid, u.name, u.profession, u.phoneHash, u.age, u.emailHash, u.registeredAt, u.exists);
    }
    
    function getRegisteredUsersCount() public view returns (uint256) {
        return userCount;
    }
}