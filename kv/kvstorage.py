from pysyncobj import SyncObj, SyncObjConf, replicated


class KVStorage(SyncObj):
    def __init__(self, selfAddress, partnerAddrs):
        conf = SyncObjConf()
        super(KVStorage, self).__init__(selfAddress, partnerAddrs, conf)
        self.__data = {}

    @replicated
    def put(self, key, value):
        print("put key: ", key, " with value: ", value)
        # TODO start: implement the Put operation, that sets the value of the key to be the provided value.
        pass
        # TODO end

    @replicated
    def append(self, key, value):
        print("append key: ", key, " with value: ", value)
        # TODO start: implement the Append operation, that adds the provided value to the value of the key.
        pass
        # TODO end

    def get(self, key):
        print("get key: ", key)
        # TODO start: implement the Get operation, that retrieves the value of the provided key.
        return None
        # TODO end
