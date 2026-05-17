// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract DSWDReliefTracker is ERC1155, Ownable, ReentrancyGuard {
    uint256 public currentBatchId;
    uint256 public currentHandoverId;

    enum HandoverStatus {
        None,
        Released,
        Accepted,
        Cancelled
    }

    struct Batch {
        uint256 batchId;
        string manifestNumber;
        string batchTokenId;
        string manifestHash;
        string category;
        uint256 quantity;
        string destination;
        address mintedBy;
        uint256 mintedAt;
    }

    struct Handover {
        uint256 handoverId;
        string drNumber;
        string handoverContractId;
        string category;
        uint256 quantity;
        string fromLocation;
        string destination;
        string senderGps;
        string receiverGps;
        address sender;
        address receiver;
        uint256 releasedAt;
        uint256 acceptedAt;
        HandoverStatus status;
    }

    mapping(uint256 => Batch) public batches;
    mapping(string => uint256) public batchIdByTokenId;
    mapping(string => uint256) public batchIdByManifestNumber;

    mapping(uint256 => Handover) public handovers;
    mapping(string => uint256) public handoverIdByDrNumber;
    mapping(string => uint256) public handoverIdByContractId;

    event BatchTokenMinted(
        uint256 indexed batchId,
        string manifestNumber,
        string batchTokenId,
        string manifestHash,
        string category,
        uint256 quantity,
        string destination,
        address indexed mintedBy
    );

    event ReleaseSigned(
        uint256 indexed handoverId,
        string drNumber,
        string handoverContractId,
        string category,
        uint256 quantity,
        string fromLocation,
        string destination,
        string senderGps,
        address indexed sender
    );

    event ReceiptConfirmed(
        uint256 indexed handoverId,
        string drNumber,
        string handoverContractId,
        string receiverGps,
        address indexed receiver
    );

    constructor() ERC1155("") Ownable(msg.sender) {}

    function mintBatchToken(
        string memory manifestNumber,
        string memory batchTokenId,
        string memory manifestHash,
        string memory category,
        uint256 quantity,
        string memory destination
    ) external onlyOwner returns (uint256) {
        require(quantity > 0, "Quantity must be greater than 0");
        require(bytes(manifestNumber).length > 0, "Manifest number is required");
        require(bytes(batchTokenId).length > 0, "Batch token ID is required");
        require(bytes(manifestHash).length > 0, "Manifest hash is required");
        require(batchIdByTokenId[batchTokenId] == 0, "Batch token already exists");
        require(batchIdByManifestNumber[manifestNumber] == 0, "Manifest already minted");

        currentBatchId += 1;
        uint256 newBatchId = currentBatchId;

        batches[newBatchId] = Batch({
            batchId: newBatchId,
            manifestNumber: manifestNumber,
            batchTokenId: batchTokenId,
            manifestHash: manifestHash,
            category: category,
            quantity: quantity,
            destination: destination,
            mintedBy: msg.sender,
            mintedAt: block.timestamp
        });

        batchIdByTokenId[batchTokenId] = newBatchId;
        batchIdByManifestNumber[manifestNumber] = newBatchId;

        _mint(msg.sender, newBatchId, quantity, "");

        emit BatchTokenMinted(
            newBatchId,
            manifestNumber,
            batchTokenId,
            manifestHash,
            category,
            quantity,
            destination,
            msg.sender
        );

        return newBatchId;
    }

    function signRelease(
        string memory drNumber,
        string memory handoverContractId,
        string memory category,
        uint256 quantity,
        string memory fromLocation,
        string memory destination,
        string memory senderGps
    ) external returns (uint256) {
        require(quantity > 0, "Quantity must be greater than 0");
        require(bytes(drNumber).length > 0, "DR number is required");
        require(bytes(handoverContractId).length > 0, "Handover ID is required");
        require(bytes(senderGps).length > 0, "Sender GPS is required");
        require(bytes(senderGps).length <= 100, "Sender GPS too long");
        require(handoverIdByDrNumber[drNumber] == 0, "DR already released");
        require(handoverIdByContractId[handoverContractId] == 0, "Handover already exists");

        currentHandoverId += 1;
        uint256 newHandoverId = currentHandoverId;

        handovers[newHandoverId] = Handover({
            handoverId: newHandoverId,
            drNumber: drNumber,
            handoverContractId: handoverContractId,
            category: category,
            quantity: quantity,
            fromLocation: fromLocation,
            destination: destination,
            senderGps: senderGps,
            receiverGps: "",
            sender: msg.sender,
            receiver: address(0),
            releasedAt: block.timestamp,
            acceptedAt: 0,
            status: HandoverStatus.Released
        });

        handoverIdByDrNumber[drNumber] = newHandoverId;
        handoverIdByContractId[handoverContractId] = newHandoverId;

        emit ReleaseSigned(
            newHandoverId,
            drNumber,
            handoverContractId,
            category,
            quantity,
            fromLocation,
            destination,
            senderGps,
            msg.sender
        );

        return newHandoverId;
    }

    function confirmReceipt(
        string memory drNumber,
        string memory handoverContractId,
        string memory destination,
        string memory receiverGps
    ) external nonReentrant returns (uint256) {
        require(bytes(receiverGps).length > 0, "Receiver GPS is required");
        require(bytes(receiverGps).length <= 100, "Receiver GPS too long");

        uint256 handoverId = handoverIdByDrNumber[drNumber];
        require(handoverId != 0, "Handover not found");

        Handover storage handover = handovers[handoverId];
        require(handover.status == HandoverStatus.Released, "Handover is not releasable");
        require(
            keccak256(bytes(handover.handoverContractId)) == keccak256(bytes(handoverContractId)),
            "Handover ID mismatch"
        );
        require(
            bytes(destination).length == 0 ||
                keccak256(bytes(handover.destination)) == keccak256(bytes(destination)),
            "Destination mismatch"
        );

        handover.receiver = msg.sender;
        handover.receiverGps = receiverGps;
        handover.acceptedAt = block.timestamp;
        handover.status = HandoverStatus.Accepted;

        emit ReceiptConfirmed(handoverId, drNumber, handoverContractId, receiverGps, msg.sender);

        return handoverId;
    }

    function getBatchByTokenId(string memory batchTokenId) external view returns (Batch memory) {
        uint256 batchId = batchIdByTokenId[batchTokenId];
        require(batchId != 0, "Batch not found");
        return batches[batchId];
    }

    function getHandoverByDrNumber(string memory drNumber) external view returns (Handover memory) {
        uint256 handoverId = handoverIdByDrNumber[drNumber];
        require(handoverId != 0, "Handover not found");
        return handovers[handoverId];
    }
}
