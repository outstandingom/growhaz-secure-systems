
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract TimelineLogger {
    mapping(address => bool) public authorisedWriters;
    address public admin;

    event TimelineEntry(
        string indexed entityType,
        string indexed entityId,
        string action,
        string description,
        address indexed actor,
        uint256 timestamp
    );

    modifier onlyAuthorised() {
        require(authorisedWriters[msg.sender] || msg.sender == admin, "Not authorised");
        _;
    }

    constructor() {
        admin = msg.sender;
    }

    function setWriter(address _writer, bool _status) external {
        require(msg.sender == admin, "Admin only");
        authorisedWriters[_writer] = _status;
    }

    function record(
        string calldata _entityType,
        string calldata _entityId,
        string calldata _action,
        string calldata _description
    ) external onlyAuthorised {
        emit TimelineEntry(_entityType, _entityId, _action, _description, tx.origin, block.timestamp);
    }
}
