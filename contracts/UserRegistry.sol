// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./TimelineLogger.sol";

contract UserRegistry {
    TimelineLogger public timeline;

    struct UserProfile {
        string ipfsHash;
        uint256 updatedAt;
    }

    mapping(address => UserProfile) public profiles;

    event UserRegistered(address indexed user, string ipfsHash);
    event UserUpdated(address indexed user, string newIpfsHash);

    constructor(address _timeline) {
        timeline = TimelineLogger(_timeline);
    }

    function registerOrUpdate(string calldata _ipfsHash) external {
        bool isNew = profiles[msg.sender].updatedAt == 0;
        profiles[msg.sender] = UserProfile(_ipfsHash, block.timestamp);
        if (isNew) {
            emit UserRegistered(msg.sender, _ipfsHash);
            timeline.record("user", _addrToStr(msg.sender), "registered", "User created");
        } else {
            emit UserUpdated(msg.sender, _ipfsHash);
            timeline.record("user", _addrToStr(msg.sender), "updated", "Profile updated");
        }
    }

    function getProfile(address _user) external view returns (string memory, uint256) {
        UserProfile memory p = profiles[_user];
        return (p.ipfsHash, p.updatedAt);
    }

    // Helper
    function _addrToStr(address x) internal pure returns (string memory) {
        bytes memory s = new bytes(40);
        for (uint i = 0; i < 20; i++) {
            bytes1 b = bytes1(uint8(uint(uint160(x)) / (2 ** (8 * (19 - i)))));
            bytes1 hi = bytes1(uint8(b) / 16);
            bytes1 lo = bytes1(uint8(b) - 16 * uint8(hi));
            s[2 * i]     = _char(hi);
            s[2 * i + 1] = _char(lo);
        }
        return string(s);
    }
    function _char(bytes1 b) internal pure returns (bytes1) {
        return uint8(b) < 10 ? bytes1(uint8(b) + 0x30) : bytes1(uint8(b) + 0x57);
    }
}
