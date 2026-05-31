// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract AuthorizationRegistry {
    struct Authorisation {
        address organisation;
        string processType;
        bool active;
        uint256 grantedAt;
        uint256 expiresAt;
    }

    mapping(address => mapping(address => mapping(string => Authorisation))) public authorisations;

    event EmployeeAuthorised(address indexed employee, address indexed organisation, string processType, uint256 expiresAt);
    event EmployeeRevoked(address indexed employee, address indexed organisation, string processType);

    function authorise(address _employee, string calldata _processType, uint256 _expiresAt) external {
        authorisations[_employee][msg.sender][_processType] = Authorisation({
            organisation: msg.sender,
            processType: _processType,
            active: true,
            grantedAt: block.timestamp,
            expiresAt: _expiresAt
        });
        emit EmployeeAuthorised(_employee, msg.sender, _processType, _expiresAt);
    }

    function revoke(address _employee, string calldata _processType) external {
        authorisations[_employee][msg.sender][_processType].active = false;
        emit EmployeeRevoked(_employee, msg.sender, _processType);
    }

    function isAuthorised(
        address _employee,
        address _organisation,
        string calldata _processType
    ) public view returns (bool) {
        Authorisation storage auth = authorisations[_employee][_organisation][_processType];
        if (!auth.active) return false;
        if (auth.expiresAt > 0 && block.timestamp > auth.expiresAt) return false;
        return true;
    }
}
