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
        string[] batchTokenIds;
        uint256[] batchQuantities;
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
        address indexed mintedBy
    );

    event ReleaseSigned(
        uint256 indexed handoverId,
        string drNumber,
        string handoverContractId,
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

        Batch storage batch = batches[newBatchId];
        batch.batchId = newBatchId;
        batch.manifestNumber = manifestNumber;
        batch.batchTokenId = batchTokenId;
        batch.manifestHash = manifestHash;
        batch.category = category;
        batch.quantity = quantity;
        batch.destination = destination;
        batch.mintedBy = msg.sender;
        batch.mintedAt = block.timestamp;

        batchIdByTokenId[batchTokenId] = newBatchId;
        batchIdByManifestNumber[manifestNumber] = newBatchId;

        _mint(msg.sender, newBatchId, quantity, "");

        emit BatchTokenMinted(
            newBatchId,
            manifestNumber,
            batchTokenId,
            manifestHash,
            msg.sender
        );

        return newBatchId;
    }

    function signRelease(
        string memory drNumber,
        string memory handoverContractId,
        string memory category,
        uint256 quantity,
        string[] memory batchTokenIds,
        uint256[] memory batchQuantities,
        string memory fromLocation,
        string memory destination,
        string memory senderGps
    ) external returns (uint256) {
        require(
            msg.sender == owner() || isApprovedForAll(owner(), msg.sender),
            "Sender not approved to transfer custody"
        );
        require(quantity > 0, "Quantity must be greater than 0");
        require(bytes(drNumber).length > 0, "DR number is required");
        require(bytes(handoverContractId).length > 0, "Handover ID is required");
        require(bytes(senderGps).length > 0, "Sender GPS is required");
        require(bytes(senderGps).length <= 100, "Sender GPS too long");
        require(batchTokenIds.length > 0, "Batch tokens are required");
        require(batchTokenIds.length == batchQuantities.length, "Batch allocation mismatch");
        require(handoverIdByDrNumber[drNumber] == 0, "DR already released");
        require(handoverIdByContractId[handoverContractId] == 0, "Handover already exists");

        uint256 allocatedTotal = 0;
        for (uint256 i = 0; i < batchTokenIds.length; i++) {
            require(batchIdByTokenId[batchTokenIds[i]] != 0, "Batch token not found");
            require(batchQuantities[i] > 0, "Batch quantity must be greater than 0");
            allocatedTotal += batchQuantities[i];
        }
        require(allocatedTotal == quantity, "Batch quantities must match release quantity");

        currentHandoverId += 1;
        uint256 newHandoverId = currentHandoverId;

        Handover storage handover = handovers[newHandoverId];
        handover.handoverId = newHandoverId;
        handover.drNumber = drNumber;
        handover.handoverContractId = handoverContractId;
        handover.category = category;
        handover.quantity = quantity;
        handover.batchTokenIds = batchTokenIds;
        handover.batchQuantities = batchQuantities;
        handover.fromLocation = fromLocation;
        handover.destination = destination;
        handover.senderGps = senderGps;
        handover.sender = msg.sender;
        handover.releasedAt = block.timestamp;
        handover.status = HandoverStatus.Released;

        for (uint256 i = 0; i < batchTokenIds.length; i++) {
            uint256 batchId = batchIdByTokenId[batchTokenIds[i]];
            _safeTransferFrom(owner(), msg.sender, batchId, batchQuantities[i], "");
        }

        handoverIdByDrNumber[drNumber] = newHandoverId;
        handoverIdByContractId[handoverContractId] = newHandoverId;

        emit ReleaseSigned(
            newHandoverId,
            drNumber,
            handoverContractId,
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

        for (uint256 i = 0; i < handover.batchTokenIds.length; i++) {
            uint256 batchId = batchIdByTokenId[handover.batchTokenIds[i]];
            _safeTransferFrom(handover.sender, msg.sender, batchId, handover.batchQuantities[i], "");
        }

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
