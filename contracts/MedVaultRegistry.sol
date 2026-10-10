// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * MedVault — on-chain registry for decentralized medical records.
 *
 * Real-world flow: encrypted record blobs are pinned to IPFS; ONLY the
 * content hash (CID digest) is anchored on-chain here. The patient owns
 * the record, and grants/reviews view consent per practitioner.
 */
contract MedVaultRegistry {
    enum Role { None, Patient, Practitioner }

    struct Record {
        address patient;      // owner
        bytes32 blobHash;     // content hash of the IPFS blob
        string cid;           // IPFS CID string (for retrieval)
        uint256 timestamp;
        bool exists;
    }

    struct Consent {
        bool granted;
        uint256 grantedAt;
    }

    address public admin;
    mapping(address => Role) public roles;
    mapping(bytes32 => Record) private records;      // recordIdHash -> Record
    // recordIdHash => practitioner => consent
    mapping(bytes32 => mapping(address => Consent)) private consents;
    mapping(bytes32 => string) private recordMetadata;
    mapping(address => bytes32[]) private ownedRecords;
    bytes32[] private allRecordIds;

    event RoleGranted(address indexed account, Role role);
    event RecordAdded(address indexed patient, bytes32 indexed recordId, bytes32 blobHash, string cid);
    event ConsentGranted(address indexed patient, address indexed practitioner, bytes32 indexed recordId);
    event ConsentRevoked(address indexed patient, address indexed practitioner, bytes32 indexed recordId);

    modifier onlyAdmin() { require(msg.sender == admin, "not admin"); _; }
    modifier onlyPatient(bytes32 recordId) {
        require(records[recordId].patient == msg.sender, "not record owner");
        _;
    }

    constructor() {
        admin = msg.sender;
        roles[msg.sender] = Role.Practitioner;
    }

    function grantRole(address account, Role role) external onlyAdmin {
        roles[account] = role;
        emit RoleGranted(account, role);
    }

    /// @notice Patient anchors a new encrypted record (stored on IPFS off-chain).
    function addRecord(bytes32 recordId, bytes32 blobHash, string calldata cid, string calldata metadata)
        external
    {
        require(roles[msg.sender] == Role.Patient, "caller not patient");
        require(!records[recordId].exists, "record exists");
        records[recordId] = Record({
            patient: msg.sender,
            blobHash: blobHash,
            cid: cid,
            timestamp: block.timestamp,
            exists: true
        });
        recordMetadata[recordId] = metadata;
        ownedRecords[msg.sender].push(recordId);
        allRecordIds.push(recordId);
        emit RecordAdded(msg.sender, recordId, blobHash, cid);
    }

    /// @notice Patient grants a practitioner view-consent for one record.
    function grantConsent(bytes32 recordId, address practitioner) external onlyPatient(recordId) {
        require(roles[practitioner] == Role.Practitioner, "grantee not practitioner");
        consents[recordId][practitioner] = Consent({ granted: true, grantedAt: block.timestamp });
        emit ConsentGranted(msg.sender, practitioner, recordId);
    }

    function revokeConsent(bytes32 recordId, address practitioner) external onlyPatient(recordId) {
        consents[recordId][practitioner].granted = false;
        emit ConsentRevoked(msg.sender, practitioner, recordId);
    }

    function hasViewAccess(bytes32 recordId, address viewer) external view returns (bool) {
        if (records[recordId].patient == viewer) return true;
        return consents[recordId][viewer].granted;
    }

    function getRecord(bytes32 recordId)
        external view
        returns (address patient, bytes32 blobHash, string memory cid, uint256 timestamp)
    {
        Record memory r = records[recordId];
        require(r.exists, "no record");
        return (r.patient, r.blobHash, r.cid, r.timestamp);
    }

    function getOwnedRecords(address patient) external view returns (bytes32[] memory) {
        return ownedRecords[patient];
    }

    function totalRecords() external view returns (uint256) {
        return allRecordIds.length;
    }
}
