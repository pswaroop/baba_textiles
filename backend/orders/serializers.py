# from rest_framework import serializers
# from .models import Order, OrderItem

# class OrderSerializer(serializers.ModelSerializer):
#     items = OrderItemSerializer(many=True)

#     class Meta:
#         model = Order
#         fields = [
#             'id',
#             'order_number',
#             'customer_name',
#             'items',
#             'created_at',
#             'status'  # ✅ THIS IS IMPORTANT
#         ]
#         read_only_fields = ['order_number', 'created_at']

# # class OrderSerializer(serializers.ModelSerializer):
# #     items = OrderItemSerializer(many=True)

# #     class Meta:
# #         model = Order
# #         # We include 'order_number' so the frontend can show it
# #         fields = ['id', 'order_number', 'customer_name', 'items', 'created_at']
# #         read_only_fields = ['order_number', 'created_at']

# #     def create(self, validated_data):
# #         items_data = validated_data.pop('items')
# #         order = Order.objects.create(**validated_data)
        
# #         for item_data in items_data:
# #             OrderItem.objects.create(order=order, **item_data)
            
# #         return order
from rest_framework import serializers
from .models import Order, OrderItem

class OrderItemSerializer(serializers.ModelSerializer):
    variant_name = serializers.ReadOnlyField(source='variant.name')

    class Meta:
        model = OrderItem
        fields = ['variant_name', 'quantity']


class OrderSerializer(serializers.ModelSerializer):
    items = OrderItemSerializer(many=True)

    class Meta:
        model = Order
        fields = [
            'id',
            'order_number',
            'customer_name',
            'items',
            'created_at',
            'status'  # ✅ MUST BE HERE
        ]
        read_only_fields = ['order_number', 'created_at']