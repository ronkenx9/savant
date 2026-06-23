// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "../src/AgentINFT.sol";

contract Deploy is Script {
    function run() external {
        uint256 pk = vm.envUint("DEPLOYER_PRIVATE_KEY");
        vm.startBroadcast(pk);
        AgentINFT nft = new AgentINFT();
        vm.stopBroadcast();
        console2.log("AgentINFT deployed at:", address(nft));
    }
}
