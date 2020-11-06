module.exports = function(RED) {

    function CharCountNode(config) {
        RED.nodes.createNode(this,config);
        var node = this;
        node.on('input', function(msg) {
            msg.payload = Number(msg.payload.length);
            node.send(msg);
        });
    }


    function RequestData(){
    	
    }
    RED.nodes.registerType("apple-find-me",CharCountNode);
}
